"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Level, QueryExecutionResult, ComparisonResult } from "@/types";
import SqlEditor from "@/components/SqlEditor";
import ResultTable from "@/components/ResultTable";
import TablePreview from "@/components/TablePreview";
import HintSystem from "@/components/HintSystem";
import SchemaDesignWizard from "@/components/SchemaDesignWizard";
import Button from "@/components/Button";
import { useProgress } from "@/lib/hooks";

type AuthUser = {
  id: string;
  name: string;
  email: string;
};

type QueryResultWithExpectation = QueryExecutionResult & {
  isExpected?: boolean;
};

type SchemaValidationApiResponse = ComparisonResult & {
  error?: string;
  details?: string;
  mode?: "create" | "insert";
  schemaReadyForInsert?: boolean;
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

function toSafeComparisonResult(
  payload: Partial<SchemaValidationApiResponse> | null | undefined,
): ComparisonResult & {
  mode?: "create" | "insert";
  schemaReadyForInsert?: boolean;
  missingInsertIssues?: string[];
  insertCounts?: Record<string, number>;
  execution?: SchemaValidationApiResponse["execution"];
  neon?: SchemaValidationApiResponse["neon"];
} {
  return {
    isCorrect: Boolean(payload?.isCorrect),
    score: typeof payload?.score === "number" ? payload.score : 0,
    correctTables: payload?.correctTables ?? [],
    missingTables: payload?.missingTables ?? [],
    extraTables: payload?.extraTables ?? [],
    incorrectColumns: payload?.incorrectColumns ?? [],
    missingForeignKeys: payload?.missingForeignKeys ?? [],
    extraForeignKeys: payload?.extraForeignKeys ?? [],
    issues: payload?.issues ?? [
      payload?.error || payload?.details || "Failed to validate schema",
    ],
    mode: payload?.mode,
    schemaReadyForInsert: payload?.schemaReadyForInsert,
    missingInsertIssues: payload?.missingInsertIssues ?? [],
    insertCounts: payload?.insertCounts ?? {},
    execution: payload?.execution,
    neon: payload?.neon,
  };
}

export default function LevelPage() {
  const params = useParams();
  const router = useRouter();
  const levelId = params?.id as string;

  const [level, setLevel] = useState<Level | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<QueryResultWithExpectation | null>(null);
  const [schemaComparisonResult, setSchemaComparisonResult] =
    useState<ReturnType<typeof toSafeComparisonResult> | null>(null);
  const [executing, setExecuting] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const { saveProgress } = useProgress(user?.id);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        setUser(data.user || null);
        setAuthLoading(false);
      })
      .catch(() => {
        setAuthLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!levelId) return;

    fetch(`/api/levels?id=${levelId}`)
      .then((res) => res.json())
      .then((data) => {
        setLevel(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load level:", err);
        setLoading(false);
      });
  }, [levelId]);

  useEffect(() => {
    router.prefetch("/");
  }, [router]);

  const handleExecute = async () => {
    if (!level || !query.trim()) return;

    setExecuting(true);
    try {
      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          schema: level.schema || [],
          sampleData: level.sampleData || [],
          expectedQuery: level.expectedQuery,
        }),
      });

      const data = (await response.json()) as QueryResultWithExpectation;
      setResult(data);

      if (data.success && data.isExpected && user) {
        await saveProgress(
          level.id,
          true,
          level.xp,
          undefined,
          query,
          hintsUsed,
        );
      }
    } catch {
      setResult({
        success: false,
        error: "Failed to execute query",
        executionTime: 0,
      });
    } finally {
      setExecuting(false);
    }
  };

  const handleCreateTableValidate = async (sql: string) => {
    if (!level || !level.expectedSchema) return;

    setExecuting(true);
    try {
      const response = await fetch("/api/schema/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "create",
          levelId: level.id,
          createTableStatements: sql,
          expectedSchema: level.expectedSchema,
          requiredInserts: level.requiredInserts || {},
        }),
      });

      const raw =
        (await response.json()) as Partial<SchemaValidationApiResponse>;
      const data = toSafeComparisonResult(raw);
      setSchemaComparisonResult(data);

      if (data.isCorrect && user) {
        await saveProgress(
          level.id,
          true,
          level.xp,
          level.expectedSchema,
          undefined,
          hintsUsed,
        );
      }

      return data;
    } catch {
      const errorResult = toSafeComparisonResult({
        isCorrect: false,
        correctTables: [],
        missingTables: [],
        extraTables: [],
        incorrectColumns: [],
        missingForeignKeys: [],
        extraForeignKeys: [],
        issues: ["Failed to validate schema"],
        score: 0,
      });
      setSchemaComparisonResult(errorResult);
      return errorResult;
    } finally {
      setExecuting(false);
    }
  };

  const handleInsertValidate = async (createSql: string, insertSql: string) => {
    if (!level || !level.expectedSchema) return;

    setExecuting(true);
    try {
      const response = await fetch("/api/schema/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "insert",
          levelId: level.id,
          createTableStatements: createSql,
          insertStatements: insertSql,
          expectedSchema: level.expectedSchema,
          requiredInserts: level.requiredInserts || {},
        }),
      });

      const raw =
        (await response.json()) as Partial<SchemaValidationApiResponse>;
      const data = toSafeComparisonResult(raw);
      setSchemaComparisonResult(data);

      if (data.isCorrect && user) {
        await saveProgress(
          level.id,
          true,
          level.xp,
          level.expectedSchema,
          undefined,
          hintsUsed,
        );
      }

      return data;
    } catch {
      const errorResult = toSafeComparisonResult({
        isCorrect: false,
        correctTables: [],
        missingTables: [],
        extraTables: [],
        incorrectColumns: [],
        missingForeignKeys: [],
        extraForeignKeys: [],
        issues: ["Failed to validate inserts"],
        score: 0,
      });
      setSchemaComparisonResult(errorResult);
      return errorResult;
    } finally {
      setExecuting(false);
    }
  };

  const handleShowHint = (index: number) => {
    setHintsUsed(index + 1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-gray-600">Loading level...</p>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-gray-600">Loading User...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-3">
          <p className="text-lg text-gray-700">
            Please log in to continue this task.
          </p>
          <Button onClick={() => router.push("/")}>Go to Login</Button>
        </div>
      </div>
    );
  }

  if (!level) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-gray-600">Level not found</p>
      </div>
    );
  }

  // SCHEMA DESIGN MODE - Use Wizard
  if (level.type === "schema") {
    return (
      <>
        <header className="border-b border-gray-200 bg-white px-4 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <Button onClick={() => router.back()} variant="secondary" size="sm">
              ← Back
            </Button>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900">
                {level.title}
              </h1>
              <p className="text-gray-600">{level.description}</p>
            </div>
            <div className="text-right">
              <span className="inline-block rounded bg-yellow-100 px-3 py-1 font-semibold text-yellow-800">
                {level.xp} XP
              </span>
            </div>
          </div>
        </header>
        <SchemaDesignWizard
          level={{
            id: level.id,
            story: level.story,
            expectedSchema: level.expectedSchema || [],
            requiredInserts: level.requiredInserts,
            hints: level.hints,
            xp: level.xp,
          }}
          hintsUsed={hintsUsed}
          onHintClick={handleShowHint}
          onValidate={handleCreateTableValidate}
          onValidateInserts={handleInsertValidate}
          validationResult={schemaComparisonResult}
          executing={executing}
          onComplete={() => router.push("/")}
        />
      </>
    );
  }

  // QUERY MODE - Normal Layout
  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 via-cyan-50/40 to-white">
      {/* Header */}
      <header className="border-b border-cyan-100 bg-white/90 px-4 py-4 backdrop-blur">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <Button onClick={() => router.back()} variant="secondary" size="sm">
              ← Back
            </Button>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">{level.title}</h1>
            <p className="text-gray-600">{level.description}</p>
          </div>
          <div className="text-right">
            <span className="inline-block rounded bg-yellow-100 px-3 py-1 font-semibold text-yellow-800">
              {level.xp} XP
            </span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-7xl mx-auto p-3 lg:p-5">
        <div className="grid grid-cols-1 gap-4 lg:gap-5 lg:grid-cols-12">
          {/* Main Column */}
          <div className="lg:col-span-8 space-y-5">
            <div className="rounded-2xl border border-cyan-100 bg-white shadow-sm p-5">
              <h3 className="mb-2 text-lg font-bold text-slate-900">
                📖 Mission
              </h3>
              <p className="text-sm leading-relaxed text-slate-700">
                {level.story}
              </p>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-lg bg-cyan-50 px-3 py-2 text-xs font-medium text-cyan-900">
                  Step 1: Write the expected SELECT query
                </div>
                <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                  Step 2: Match the exact expected output
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-100 bg-white shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">
                  🧠 SQL Editor
                </h3>
                <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                  Query Task
                </span>
              </div>
              <SqlEditor
                value={query}
                onChange={setQuery}
                onExecute={handleExecute}
                isLoading={executing}
              />
            </div>

            {result && (
              <div className="rounded-2xl border border-cyan-100 bg-white shadow-sm p-5">
                <h3 className="mb-3 text-lg font-bold text-slate-900">
                  📊 Query Result
                </h3>
                <ResultTable result={result} />
                {typeof result.isExpected === "boolean" && (
                  <div
                    className={`mt-4 rounded-lg border px-4 py-3 text-sm font-semibold ${
                      result.isExpected
                        ? "border-green-200 bg-green-50 text-green-700"
                        : "border-orange-200 bg-orange-50 text-orange-700"
                    }`}
                  >
                    {result.isExpected
                      ? "Expected query matched. Task completed and saved."
                      : "Query executed, but it does not exactly match the expected task query yet."}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Side Column */}
          <div className="lg:col-span-4 lg:sticky lg:top-3 self-start">
            <div className="space-y-4 lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto lg:pr-1">
              <div className="rounded-2xl border border-cyan-100 bg-white shadow-sm p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900">💡 Hints</h3>
                  <span className="text-xs text-slate-500">
                    Used: {hintsUsed}
                  </span>
                </div>
                <div className="max-h-64 overflow-y-auto pr-1">
                  <HintSystem hints={level.hints} onShowHint={handleShowHint} />
                </div>
                {hintsUsed > 0 && (
                  <p className="mt-3 text-xs text-slate-500">
                    More hints reduce challenge score, but help you learn
                    faster.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-cyan-100 bg-white shadow-sm p-4">
                <h3 className="mb-3 font-bold text-slate-900">
                  🗂️ Schema Reference
                </h3>
                <div className="max-h-80 overflow-y-auto pr-1">
                  {level.schema && <TablePreview tables={level.schema} />}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
