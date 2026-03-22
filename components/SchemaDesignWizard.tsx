"use client";

import { useMemo, useState } from "react";
import { TableSchema } from "@/types";
import Button from "./Button";
import FixedERDiagram from "./FixedERDiagram";

type SchemaDesignStage = "start" | "view-erd" | "create-tables";

type ValidationResult = {
  isCorrect: boolean;
  score: number;
  mode?: "create" | "insert";
  schemaReadyForInsert?: boolean;
  missingTables?: string[];
  extraTables?: string[];
  incorrectColumns?: Array<{ table: string; issues: string[] }>;
  missingForeignKeys?: Array<{ from: string; to: string }>;
  missingInsertIssues?: string[];
  insertCounts?: Record<string, number>;
  execution?: {
    success: boolean;
    statementCount: number;
    executedCreateTables: string[];
    insertCounts: Record<string, number>;
    error?: string;
  };
  neon?: {
    success: boolean;
    schemaName?: string;
    statementCount: number;
    executedCreateTables: string[];
    insertCounts: Record<string, number>;
    error?: string;
  };
};

interface SchemaDesignWizardProps {
  level: {
    id?: string;
    story: string;
    expectedSchema: TableSchema[];
    requiredInserts?: Record<string, number>;
    hints: string[];
    xp?: number;
  };
  hintsUsed: number;
  onHintClick: (index: number) => void;
  onValidate: (sql: string) => Promise<ValidationResult | undefined>;
  onValidateInserts: (
    createSql: string,
    insertSql: string,
  ) => Promise<ValidationResult | undefined>;
  validationResult: ValidationResult | null;
  executing: boolean;
  onComplete?: () => Promise<void> | void;
}

export default function SchemaDesignWizard({
  level,
  hintsUsed,
  onHintClick,
  onValidate,
  onValidateInserts,
  validationResult,
  executing,
  onComplete,
}: SchemaDesignWizardProps) {
  const [stage, setStage] = useState<SchemaDesignStage>("create-tables");
  const [createTableSQL, setCreateTableSQL] = useState("");
  const [insertSQL, setInsertSQL] = useState("");
  const [currentHintIndex, setCurrentHintIndex] = useState(0);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(
    new Set(level.expectedSchema.map((t) => t.name)),
  );

  const createTablePlaceholder = useMemo(() => {
    if (!level.expectedSchema.length) {
      return "CREATE TABLE example_table (\n  id INT PRIMARY KEY\n);";
    }

    return level.expectedSchema
      .map((table) => {
        const columnLines = table.columns.map((column) => {
          const parts = [column.name, column.type];

          if (column.isPrimary) {
            parts.push("PRIMARY KEY");
          }

          if (column.isNullable === false && !column.isPrimary) {
            parts.push("NOT NULL");
          }

          if (column.isForeign && column.references) {
            parts.push(
              `REFERENCES ${column.references.table}(${column.references.column})`,
            );
          }

          return `  ${parts.join(" ")}`;
        });

        return `CREATE TABLE ${table.name} (\n${columnLines.join(",\n")}\n);`;
      })
      .join("\n\n");
  }, [level.expectedSchema]);

  const insertPlaceholder = useMemo(() => {
    const required = level.requiredInserts || {};
    const tableNames = Object.keys(required).length
      ? Object.keys(required)
      : level.expectedSchema.slice(0, 2).map((table) => table.name);

    if (!tableNames.length) {
      return "INSERT INTO example_table (id) VALUES (1);";
    }

    return tableNames
      .map((tableName) => {
        const table = level.expectedSchema.find(
          (item) => item.name === tableName,
        );
        if (!table || table.columns.length === 0) {
          return `INSERT INTO ${tableName} VALUES (...);`;
        }

        const cols = table.columns;
        const columnList = cols.map((col) => col.name).join(", ");
        const sampleValues = cols
          .map((col) => {
            if (col.type === "INT" || col.type === "FLOAT") {
              return "1";
            }
            if (col.type === "BOOLEAN") {
              return "TRUE";
            }
            if (col.type === "DATE") {
              return "'2026-01-01'";
            }
            return `'sample_${col.name}'`;
          })
          .join(", ");

        return `INSERT INTO ${tableName} (${columnList}) VALUES (${sampleValues});`;
      })
      .join("\n");
  }, [level.expectedSchema, level.requiredInserts]);

  const toggleTableExpand = (tableName: string) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName);
    } else {
      newExpanded.add(tableName);
    }
    setExpandedTables(newExpanded);
  };

  const handleNextHint = () => {
    if (currentHintIndex < level.hints.length - 1) {
      setCurrentHintIndex(currentHintIndex + 1);
      onHintClick(currentHintIndex + 1);
    }
  };

  const handleStartDatabase = () => {
    setStage("view-erd");
  };

  const handleProceedToBuild = () => {
    setStage("create-tables");
  };

  const handleValidate = async () => {
    await onValidate(createTableSQL);
  };

  const handleValidateInserts = async () => {
    await onValidateInserts(createTableSQL, insertSQL);
  };

  const handleBackToERD = () => {
    setStage("view-erd");
  };

  const displayScore =
    validationResult && Number.isFinite(validationResult.score)
      ? Math.round(validationResult.score)
      : 0;

  const schemaReadyForInsert = Boolean(validationResult?.schemaReadyForInsert);

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 p-3">
      <div className="max-w-5xl mx-auto">
        {/* STAGE 1: CREATE DATABASE */}
        {stage === "start" && (
          <div className="flex items-center justify-center min-h-screen">
            <div className="bg-white rounded-lg shadow-2xl p-12 max-w-2xl text-center space-y-6">
              <div className="text-6xl mb-4">🏗️</div>
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Create a New Database
              </h2>
              <p className="text-lg text-gray-700 leading-relaxed">
                {level.story}
              </p>
              <div className="pt-6">
                <Button
                  onClick={handleStartDatabase}
                  className="px-12 py-4 text-lg font-semibold bg-blue-600 hover:bg-blue-700"
                >
                  📊 View Database Structure
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STAGE 2: VIEW ERD */}
        {stage === "view-erd" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 my-5">
            {/* Left Column: Mission & Hints */}
            <div className="space-y-3">
              <div className="bg-white rounded-lg shadow p-4 space-y-3">
                <h3 className="text-lg font-bold text-gray-900">📋 Mission</h3>
                <p className="text-sm text-gray-800 leading-relaxed">
                  {level.story}
                </p>
              </div>

              {/* Hints */}
              <div className="bg-white rounded-lg shadow p-4 space-y-3">
                <h3 className="font-bold text-gray-900">💡 Hints</h3>
                <p className="text-xs text-gray-500">Hints used: {hintsUsed}</p>
                <div className="space-y-3">
                  {/* Current Hint */}
                  <div className="bg-linear-to-r from-blue-50 to-blue-100 border-2 border-blue-300 rounded-lg p-3">
                    <p className="text-xs font-semibold text-blue-900 mb-2">
                      Hint {currentHintIndex + 1} of {level.hints.length}
                    </p>
                    <p className="text-sm text-gray-800 font-medium mb-3">
                      {level.hints[currentHintIndex]}
                    </p>
                    {/* Progress Bar */}
                    <div className="w-full bg-blue-200 rounded-full h-2 mb-3">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{
                          width: `${((currentHintIndex + 1) / level.hints.length) * 100}%`,
                        }}
                      />
                    </div>
                    {/* Next Hint Button */}
                    <button
                      onClick={handleNextHint}
                      disabled={currentHintIndex >= level.hints.length - 1}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-2 rounded transition-colors"
                    >
                      {currentHintIndex >= level.hints.length - 1
                        ? "✓ All Hints Revealed"
                        : "Next Hint →"}
                    </button>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleProceedToBuild}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5"
              >
                🚀 Create Tables
              </Button>
            </div>

            {/* Center & Right: Database Structure */}
            <div className="lg:col-span-2 lg:sticky lg:top-4 lg:self-start">
              <div className="bg-white rounded-lg shadow p-4 space-y-4">
                <h3 className="text-xl font-bold text-gray-900">
                  🗄️ Target Database Structure
                </h3>

                <p className="text-sm text-slate-600">
                  Parent tables are placed on the left and dependent tables on
                  the right. Relationship arrows represent foreign-key links.
                </p>

                <FixedERDiagram tables={level.expectedSchema} />

                <div className="space-y-2.5 lg:max-h-72 lg:overflow-y-auto lg:pr-1">
                  {level.expectedSchema.map((table) => {
                    const isExpanded = expandedTables.has(table.name);
                    return (
                      <div
                        key={table.name}
                        className="border border-blue-300 rounded-md overflow-hidden shadow-sm hover:shadow transition-shadow"
                      >
                        {/* Table Header - Clickable */}
                        <button
                          onClick={() => toggleTableExpand(table.name)}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 flex items-center justify-between focus:outline-none transition-colors"
                        >
                          <h4 className="text-xs font-bold uppercase tracking-wide">
                            📦 {table.name}
                          </h4>
                          <span className="text-base">
                            {isExpanded ? "▼" : "▶"}
                          </span>
                        </button>

                        {/* Columns - Collapsible */}
                        {isExpanded && (
                          <div className="bg-gray-50 p-2 space-y-1 border-t border-blue-300">
                            {table.columns.map((col) => (
                              <div
                                key={col.name}
                                className="flex items-center justify-between bg-white p-1.5 rounded border border-gray-200 hover:bg-blue-50 transition-colors"
                              >
                                <div className="flex-1">
                                  <span className="font-mono text-xs font-semibold text-gray-900">
                                    {col.name}
                                  </span>
                                  <span className="text-xs text-gray-600 ml-2">
                                    {col.type}
                                  </span>
                                </div>
                                <div className="flex gap-1">
                                  {col.isPrimary && (
                                    <span className="bg-yellow-200 text-yellow-900 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                      🔑 PK
                                    </span>
                                  )}
                                  {col.isForeign && col.references && (
                                    <span className="bg-green-200 text-green-900 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                      🔗 FK→{col.references.table}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Relationships Summary */}
                <div className="border-t-2 border-gray-300 pt-4 lg:overflow-y-auto lg:pr-1">
                  <h4 className="font-bold text-gray-900 mb-3">
                    📊 Relationships
                  </h4>
                  <div className="space-y-2 lg:max-h-40 lg:overflow-y-auto lg:pr-1">
                    {level.expectedSchema.map((table) =>
                      table.columns
                        .filter((col) => col.isForeign && col.references)
                        .map((col) => (
                          <div
                            key={`${table.name}-${col.name}`}
                            className="flex items-center gap-2 text-xs bg-purple-50 p-2.5 rounded border border-purple-200"
                          >
                            <span className="font-mono text-gray-900 font-bold">
                              {table.name}.{col.name}
                            </span>
                            <span className="text-purple-600 font-bold">→</span>
                            <span className="font-mono text-gray-900 font-bold">
                              {col.references?.table}.{col.references?.column}
                            </span>
                          </div>
                        )),
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STAGE 3: CREATE TABLES */}
        {stage === "create-tables" && (
          <div className="my-5 grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            {/* Left: User SQL + Validation */}
            <div className="lg:col-span-2 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">
                  ✍️ Write CREATE TABLE Statements
                </h3>
                <button
                  onClick={handleBackToERD}
                  className="text-blue-600 hover:text-blue-800 font-semibold text-sm"
                >
                  View Target Structure
                </button>
              </div>

              {/* SQL Editor */}
              <div className="bg-white rounded-lg shadow p-4 space-y-3">
                <div className="space-y-2">
                  <label className="block font-bold text-gray-900">
                    SQL CREATE TABLE Commands
                  </label>
                  <textarea
                    value={createTableSQL}
                    onChange={(e) => setCreateTableSQL(e.target.value)}
                    className="w-full h-64 p-3 border-2 border-gray-300 rounded-lg font-mono text-sm text-gray-900 bg-white focus:border-blue-600 focus:outline-none focus:ring-0"
                    placeholder={createTablePlaceholder}
                  />
                </div>

                <div className="bg-blue-50 border-l-4 border-blue-600 p-3">
                  <p className="text-sm text-gray-800 font-semibold mb-2">
                    💡 Tips:
                  </p>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>✓ Include PRIMARY KEY constraints</li>
                    <li>✓ Include FOREIGN KEY constraints</li>
                    <li>✓ Specify correct column types and names</li>
                    <li>✓ Match the target structure exactly</li>
                    <li>✓ Add INSERT statements for each table</li>
                  </ul>

                  {level.requiredInserts && (
                    <div className="mt-3 rounded bg-white/70 p-3">
                      <p className="text-xs font-semibold text-gray-800 mb-1">
                        Minimum inserts required:
                      </p>
                      <div className="space-y-1 text-xs text-gray-700">
                        {Object.entries(level.requiredInserts).map(
                          ([table, count]) => (
                            <p key={table}>
                              • {table}: {count} rows
                            </p>
                          ),
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleValidate}
                  disabled={!createTableSQL.trim() || executing}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5"
                >
                  {executing
                    ? "⏳ Running SQL..."
                    : "✅ Run and Validate Schema"}
                </Button>
              </div>

              {/* Your Schema (ERD) */}
              <div className="bg-white rounded-lg shadow p-4 space-y-3">
                <h3 className="text-lg font-bold text-gray-900">
                  📝 Your Schema (ERD)
                </h3>
                {validationResult?.execution?.success ? (
                  <div className="space-y-3">
                    <div className="rounded border border-green-300 bg-green-50 p-2.5">
                      <p className="text-sm font-semibold text-green-900">
                        SQL executed in validator.
                      </p>
                      <p className="text-xs text-green-800 mt-1">
                        Statements executed:{" "}
                        {validationResult.execution.statementCount}
                      </p>
                    </div>

                    {validationResult.neon?.success && (
                      <div className="rounded border border-emerald-300 bg-emerald-50 p-2.5">
                        <p className="text-sm font-semibold text-emerald-900">
                          Tables were created in Neon successfully.
                        </p>
                        <p className="text-xs text-emerald-800 mt-1">
                          Namespace: {validationResult.neon.schemaName}
                        </p>
                      </div>
                    )}

                    {validationResult.neon?.error && (
                      <div className="rounded border border-red-300 bg-red-50 p-2.5">
                        <p className="text-sm font-semibold text-red-900">
                          Neon execution error: {validationResult.neon.error}
                        </p>
                      </div>
                    )}

                    <div className="rounded border border-gray-200 bg-gray-50 p-2.5">
                      <p className="text-xs font-semibold text-gray-700 mb-2">
                        Created tables:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {validationResult.execution.executedCreateTables.map(
                          (table) => (
                            <span
                              key={table}
                              className="rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800"
                            >
                              {table}
                            </span>
                          ),
                        )}
                      </div>
                    </div>
                  </div>
                ) : createTableSQL.trim() ? (
                  <div className="space-y-3">
                    <div className="bg-gray-50 p-4 rounded border-2 border-dashed border-gray-300 text-center">
                      <p className="text-sm text-gray-600 font-semibold">
                        Click &quot;Run and Validate Schema&quot; to execute SQL
                        and create tables in Neon
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 p-6 rounded border-2 border-dashed border-gray-300 text-center">
                    <p className="text-gray-500 font-semibold">
                      No tables yet. Add tables to see the diagram.
                    </p>
                  </div>
                )}
              </div>

              {schemaReadyForInsert && (
                <div className="bg-white rounded-lg shadow p-4 space-y-3">
                  <h3 className="text-lg font-bold text-gray-900">
                    📥 Insert Data (After Tables Created)
                  </h3>
                  <p className="text-sm text-gray-700">
                    Tables are ready. Add your INSERT INTO statements and run
                    validation to check row requirements.
                  </p>

                  <textarea
                    value={insertSQL}
                    onChange={(e) => setInsertSQL(e.target.value)}
                    className="w-full h-44 p-3 border-2 border-gray-300 rounded-lg font-mono text-sm text-gray-900 bg-white focus:border-blue-600 focus:outline-none focus:ring-0"
                    placeholder={insertPlaceholder}
                  />

                  <Button
                    onClick={handleValidateInserts}
                    disabled={!insertSQL.trim() || executing}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5"
                  >
                    {executing
                      ? "⏳ Running INSERTs..."
                      : "✅ Run INSERT and Validate Data"}
                  </Button>
                </div>
              )}

              {/* Validation Results */}
              {validationResult && (
                <div className="bg-white rounded-lg shadow p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-gray-900">
                      📋 Validation Results
                    </h3>
                    <div
                      className={`text-3xl font-bold ${
                        validationResult.isCorrect
                          ? "text-green-600"
                          : "text-orange-600"
                      }`}
                    >
                      {displayScore}%
                    </div>
                  </div>

                  {/* Status */}
                  {validationResult.isCorrect ? (
                    <div className="bg-green-50 border-2 border-green-400 rounded-lg p-3 text-center">
                      <p className="text-xl font-bold text-green-700">
                        🎉 Perfect! Schema is Correct!
                      </p>
                      <p className="mt-2 text-sm text-green-800">
                        Your CREATE TABLE and INSERT work matches the task.
                      </p>
                      {onComplete && (
                        <Button
                          onClick={onComplete}
                          className="mt-4 bg-green-700 hover:bg-green-800"
                        >
                          Complete Task and Continue
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {validationResult.execution?.error && (
                        <div className="bg-red-50 border-2 border-red-400 rounded-lg p-3 lg:col-span-2">
                          <p className="font-bold text-red-900 mb-2">
                            SQL Execution Error:
                          </p>
                          <p className="text-red-800 text-sm">
                            {validationResult.execution.error}
                          </p>
                        </div>
                      )}

                      {/* Missing Tables */}
                      {(validationResult.missingTables ?? []).length > 0 && (
                        <div className="bg-red-50 border-2 border-red-400 rounded-lg p-3">
                          <p className="font-bold text-red-900 mb-2">
                            ❌ Missing Tables:
                          </p>
                          <div className="space-y-1">
                            {(validationResult.missingTables ?? []).map(
                              (table: string) => (
                                <p key={table} className="text-red-800 text-sm">
                                  • {table}
                                </p>
                              ),
                            )}
                          </div>
                        </div>
                      )}

                      {/* Extra Tables */}
                      {(validationResult.extraTables ?? []).length > 0 && (
                        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-3">
                          <p className="font-bold text-yellow-900 mb-2">
                            ⚠️ Extra Tables:
                          </p>
                          <div className="space-y-1">
                            {(validationResult.extraTables ?? []).map(
                              (table: string) => (
                                <p
                                  key={table}
                                  className="text-yellow-800 text-sm"
                                >
                                  • {table}
                                </p>
                              ),
                            )}
                          </div>
                        </div>
                      )}

                      {/* Column Issues */}
                      {(validationResult.incorrectColumns ?? []).length > 0 && (
                        <div className="bg-orange-50 border-2 border-orange-400 rounded-lg p-3 lg:col-span-2">
                          <p className="font-bold text-orange-900 mb-2">
                            🔧 Column Issues:
                          </p>
                          <div className="space-y-2">
                            {(validationResult.incorrectColumns ?? []).map(
                              (issue) => (
                                <div key={issue.table}>
                                  <p className="font-semibold text-orange-900 text-sm">
                                    {issue.table}:
                                  </p>
                                  <ul className="ml-4 space-y-1">
                                    {issue.issues.map((msg, idx) => (
                                      <li
                                        key={idx}
                                        className="text-orange-800 text-sm"
                                      >
                                        • {msg}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      )}

                      {/* Missing Foreign Keys */}
                      {(validationResult.missingForeignKeys ?? []).length >
                        0 && (
                        <div className="bg-purple-50 border-2 border-purple-400 rounded-lg p-3 lg:col-span-2">
                          <p className="font-bold text-purple-900 mb-2">
                            🔗 Missing Foreign Keys:
                          </p>
                          <ul className="space-y-1">
                            {(validationResult.missingForeignKeys ?? []).map(
                              (fk, idx: number) => (
                                <li
                                  key={idx}
                                  className="text-purple-800 text-sm"
                                >
                                  • {fk.from} → {fk.to}
                                </li>
                              ),
                            )}
                          </ul>
                        </div>
                      )}

                      {(validationResult.missingInsertIssues ?? []).length >
                        0 && (
                        <div className="bg-red-50 border-2 border-red-400 rounded-lg p-3 lg:col-span-2">
                          <p className="font-bold text-red-900 mb-2">
                            📥 Missing Required INSERT Data:
                          </p>
                          <ul className="space-y-1">
                            {(validationResult.missingInsertIssues ?? []).map(
                              (issue: string, idx: number) => (
                                <li key={idx} className="text-red-800 text-sm">
                                  • {issue}
                                </li>
                              ),
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: Expected Schema (ERD) */}
            <div className="bg-white rounded-lg shadow p-4 space-y-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-hidden">
              <h3 className="text-lg font-bold text-gray-900">
                🎯 Expected Schema (ERD)
              </h3>
              <div className="space-y-2 lg:max-h-80 lg:overflow-y-auto lg:pr-1">
                {level.expectedSchema.map((table) => {
                  const isExpanded = expandedTables.has(table.name);
                  return (
                    <div
                      key={table.name}
                      className="border border-green-300 rounded-md overflow-hidden shadow-sm hover:shadow transition-shadow"
                    >
                      {/* Table Header - Clickable */}
                      <button
                        onClick={() => toggleTableExpand(table.name)}
                        className="w-full bg-green-600 hover:bg-green-700 text-white px-2.5 py-1.5 flex items-center justify-between focus:outline-none transition-colors"
                      >
                        <h4 className="text-xs font-bold uppercase tracking-wide">
                          [{table.name}]
                        </h4>
                        <span className="text-sm">
                          {isExpanded ? "▼" : "▶"}
                        </span>
                      </button>

                      {/* Columns - Collapsible */}
                      {isExpanded && (
                        <div className="bg-gray-50 p-1.5 border-t border-green-300 space-y-1">
                          {table.columns.map((col) => (
                            <div
                              key={col.name}
                              className="flex items-center gap-1.5 bg-white p-1.5 rounded text-xs hover:bg-green-50"
                            >
                              <span className="font-mono text-xs font-semibold text-gray-900 flex-1">
                                {col.name}
                              </span>
                              <span className="text-[11px] text-gray-600">
                                {col.type}
                              </span>
                              {col.isPrimary && (
                                <span className="bg-yellow-200 text-yellow-900 px-1.5 py-0.5 rounded font-bold text-[10px]">
                                  PK
                                </span>
                              )}
                              {col.isForeign && col.references && (
                                <span className="bg-green-200 text-green-900 px-1.5 py-0.5 rounded font-bold text-[10px]">
                                  FK
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Relationships Summary */}
              <div className="border-t-2 border-gray-300 pt-3 mt-3 lg:overflow-y-auto lg:pr-1">
                <h4 className="font-bold text-gray-900 text-sm mb-2">
                  📊 Relationships:
                </h4>
                <div className="space-y-1 text-xs lg:max-h-32 lg:overflow-y-auto lg:pr-1">
                  {level.expectedSchema.map((table) =>
                    table.columns
                      .filter((col) => col.isForeign && col.references)
                      .map((col) => (
                        <div
                          key={`${table.name}-${col.name}`}
                          className="flex items-center gap-1"
                        >
                          <span className="font-mono text-gray-900">
                            {table.name}
                          </span>
                          <span className="text-green-600">─→</span>
                          <span className="font-mono text-gray-900">
                            {col.references?.table}
                          </span>
                        </div>
                      )),
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
