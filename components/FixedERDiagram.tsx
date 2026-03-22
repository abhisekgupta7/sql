"use client";

import { useMemo } from "react";
import { TableSchema } from "@/types";

type Position = { x: number; y: number };
type TableCard = {
  table: TableSchema;
  x: number;
  y: number;
  width: number;
  height: number;
};

interface FixedERDiagramProps {
  tables: TableSchema[];
}

type Relationship = {
  key: string;
  fromTable: string;
  toTable: string;
  fromColumn: string;
  toColumn: string;
};

const PADDING = 24;
const CARD_WIDTH = 230;
const COLUMN_GAP = 120;
const ROW_GAP = 24;
const HEADER_HEIGHT = 32;
const COLUMN_ROW_HEIGHT = 20;
const CARD_FOOTER = 12;

function getCardHeight(columnCount: number) {
  return Math.min(
    224,
    HEADER_HEIGHT + columnCount * COLUMN_ROW_HEIGHT + CARD_FOOTER,
  );
}

function buildRelationships(tables: TableSchema[]): Relationship[] {
  return tables.flatMap((table) =>
    table.columns
      .filter((column) => column.isForeign && column.references)
      .map((column) => ({
        key: `${table.name}-${column.name}`,
        fromTable: column.references!.table,
        toTable: table.name,
        fromColumn: column.references!.column,
        toColumn: column.name,
      })),
  );
}

function computeDepthMap(
  tables: TableSchema[],
  relationships: Relationship[],
): Map<string, number> {
  const tableNames = tables.map((table) => table.name);
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, number>();

  tableNames.forEach((name) => {
    outgoing.set(name, []);
    incoming.set(name, 0);
  });

  relationships.forEach((relationship) => {
    if (
      !outgoing.has(relationship.fromTable) ||
      !incoming.has(relationship.toTable)
    ) {
      return;
    }

    outgoing.get(relationship.fromTable)!.push(relationship.toTable);
    incoming.set(
      relationship.toTable,
      (incoming.get(relationship.toTable) || 0) + 1,
    );
  });

  const roots = tableNames.filter((name) => (incoming.get(name) || 0) === 0);
  const queue = [...roots];
  const depth = new Map<string, number>(roots.map((name) => [name, 0]));

  while (queue.length) {
    const current = queue.shift()!;
    const currentDepth = depth.get(current) || 0;
    const children = outgoing.get(current) || [];

    children.forEach((child) => {
      const nextDepth = currentDepth + 1;
      const existing = depth.get(child);

      if (existing === undefined || nextDepth > existing) {
        depth.set(child, nextDepth);
      }

      queue.push(child);
    });
  }

  tableNames.forEach((name) => {
    if (!depth.has(name)) {
      depth.set(name, 0);
    }
  });

  return depth;
}

function layoutCards(tables: TableSchema[], relationships: Relationship[]) {
  const depthMap = computeDepthMap(tables, relationships);
  const groups = new Map<number, TableSchema[]>();

  tables.forEach((table) => {
    const depth = depthMap.get(table.name) || 0;
    if (!groups.has(depth)) {
      groups.set(depth, []);
    }
    groups.get(depth)!.push(table);
  });

  const sortedDepths = Array.from(groups.keys()).sort((a, b) => a - b);
  const cards: TableCard[] = [];

  let maxColumnBottom = 0;

  sortedDepths.forEach((depth) => {
    const columnTables = groups.get(depth) || [];
    const x = PADDING + depth * (CARD_WIDTH + COLUMN_GAP);
    let y = PADDING;

    columnTables.forEach((table) => {
      const height = getCardHeight(table.columns.length);
      cards.push({ table, x, y, width: CARD_WIDTH, height });
      y += height + ROW_GAP;
    });

    maxColumnBottom = Math.max(maxColumnBottom, y);
  });

  const canvasWidth =
    PADDING * 2 +
    Math.max(1, sortedDepths.length) * CARD_WIDTH +
    Math.max(0, sortedDepths.length - 1) * COLUMN_GAP;
  const canvasHeight = Math.max(360, maxColumnBottom + PADDING);

  return { cards, canvasWidth, canvasHeight };
}

function getAnchorPoint(from: TableCard, to: TableCard): Position {
  const fromCenterY = from.y + from.height / 2;
  const toCenterY = to.y + to.height / 2;

  if (from.x <= to.x) {
    return { x: from.x + from.width, y: fromCenterY };
  }

  return { x: from.x, y: fromCenterY };
}

function shorten(value: string, max = 26) {
  if (value.length <= max) {
    return value;
  }

  return `${value.slice(0, max - 1)}...`;
}

export default function FixedERDiagram({ tables }: FixedERDiagramProps) {
  const relationships = useMemo(() => buildRelationships(tables), [tables]);
  const { cards, canvasWidth, canvasHeight } = useMemo(
    () => layoutCards(tables, relationships),
    [tables, relationships],
  );

  const edges = useMemo(
    () =>
      relationships
        .map((relationship) => {
          const fromCard = cards.find(
            (card) => card.table.name === relationship.fromTable,
          );
          const toCard = cards.find(
            (card) => card.table.name === relationship.toTable,
          );

          if (!fromCard || !toCard) {
            return null;
          }

          const from = getAnchorPoint(fromCard, toCard);
          const to = getAnchorPoint(toCard, fromCard);
          const bendX = (from.x + to.x) / 2;

          return {
            key: relationship.key,
            from,
            to,
            bendX,
          };
        })
        .filter(Boolean) as Array<{
        key: string;
        from: Position;
        to: Position;
        bendX: number;
      }>,
    [cards, relationships],
  );

  return (
    <div className="rounded-xl border border-slate-300 bg-linear-to-br from-slate-50 via-white to-cyan-50 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-bold uppercase tracking-wide text-slate-800">
          Expected ER Diagram
        </h4>
        <span className="rounded-full bg-cyan-100 px-2 py-1 text-[10px] font-semibold text-cyan-700">
          {cards.length} Tables • {edges.length} Relationships
        </span>
      </div>

      <div className="overflow-auto rounded-lg border border-slate-300 bg-white">
        <svg
          className="h-auto w-full"
          viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="8"
              refY="5"
              orient="auto"
            >
              <polygon points="0 0, 10 5, 0 10" fill="#0e7490" />
            </marker>
          </defs>

          {edges.map((edge) => (
            <g key={edge.key}>
              <path
                x1={edge.from.x}
                y1={edge.from.y}
                x2={edge.to.x}
                y2={edge.to.y}
                d={`M ${edge.from.x} ${edge.from.y} L ${edge.bendX} ${edge.from.y} L ${edge.bendX} ${edge.to.y} L ${edge.to.x} ${edge.to.y}`}
                fill="none"
                stroke="#0e7490"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
                markerEnd="url(#arrowhead)"
              />
              <text
                x={edge.bendX + 4}
                y={Math.min(edge.from.y, edge.to.y) - 6}
                textAnchor="middle"
                fill="#155e75"
                fontSize="9"
                fontWeight="700"
              >
                1:N
              </text>
            </g>
          ))}

          {cards.map((card) => (
            <g key={card.table.name}>
              <rect
                x={card.x}
                y={card.y}
                width={card.width}
                height={card.height}
                rx="10"
                fill="#ffffff"
                stroke="#94a3b8"
                strokeWidth="1.2"
              />
              <rect
                x={card.x}
                y={card.y}
                width={card.width}
                height={HEADER_HEIGHT}
                rx="10"
                fill="#0f172a"
              />
              <text
                x={card.x + 10}
                y={card.y + 21}
                fill="#ffffff"
                fontSize="11"
                fontWeight="700"
              >
                {card.table.name.toUpperCase()}
              </text>

              {card.table.columns.slice(0, 8).map((column, index) => {
                const y =
                  card.y + HEADER_HEIGHT + 16 + index * COLUMN_ROW_HEIGHT;
                const tag = column.isPrimary
                  ? "PK"
                  : column.isForeign
                    ? "FK"
                    : column.type;

                return (
                  <g key={`${card.table.name}-${column.name}`}>
                    <text
                      x={card.x + 10}
                      y={y}
                      fill="#0f172a"
                      fontSize="10"
                      fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                      fontWeight="600"
                    >
                      {shorten(column.name, 22)}
                    </text>
                    <text
                      x={card.x + card.width - 10}
                      y={y}
                      fill="#475569"
                      fontSize="9"
                      textAnchor="end"
                      fontWeight="700"
                    >
                      {tag}
                    </text>
                  </g>
                );
              })}

              {card.table.columns.length > 8 && (
                <text
                  x={card.x + 10}
                  y={card.y + card.height - 8}
                  fill="#64748b"
                  fontSize="9"
                  fontStyle="italic"
                >
                  +{card.table.columns.length - 8} more columns
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

      {edges.length === 0 && (
        <p className="mt-2 text-xs text-slate-600">
          No foreign-key relationships detected yet.
        </p>
      )}
    </div>
  );
}
