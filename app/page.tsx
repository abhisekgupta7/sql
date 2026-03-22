"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Level } from "@/types";
import WorldMap from "@/components/WorldMap";
import { useProgress } from "@/lib/hooks";

type AuthUser = {
  id: string;
  name: string;
  email: string;
};

const PROJECT_NAME = "SQL Playground";
const PROJECT_TAGLINE =
  "Learn SQL like a real database engineer: design schema, insert data, and solve analytical queries step by step.";

export default function Home() {
  const router = useRouter();
  const [levels, setLevels] = useState<Record<number, Level[]>>({});
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [selectedWorld, setSelectedWorld] = useState(1);

  const { progress, totalXP } = useProgress(user?.id);

  const taskDestinations = [
    {
      name: "College",
      description: "Departments, students, instructors, courses",
      route: "/level/college-schema",
      emoji: "🎓",
      world: 1,
    },
    {
      name: "Ecommerce",
      description: "Users, categories, products, orders",
      route: "/level/ecommerce-schema",
      emoji: "🛒",
      world: 2,
    },
    {
      name: "Restaurant",
      description: "Menus, orders, tables, billing",
      route: "/level/restaurant-schema",
      emoji: "🍽️",
      world: 3,
    },
  ];

  const selectedTask =
    taskDestinations.find((task) => task.world === selectedWorld) ||
    taskDestinations[0];

  const visibleLevels = useMemo(() => {
    return { [selectedWorld]: levels[selectedWorld] || [] };
  }, [levels, selectedWorld]);

  const completedLevelIds = useMemo(() => {
    const completed = new Set<string>();
    progress.forEach((entry, levelId) => {
      if (entry.completed) {
        completed.add(levelId);
      }
    });
    return completed;
  }, [progress]);

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
    fetch("/api/levels")
      .then((res) => res.json())
      .then((data) => {
        setLevels(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load levels:", err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!user) return;

    router.prefetch(selectedTask.route);

    const worldLevels = levels[selectedWorld] || [];
    worldLevels.forEach((level) => {
      router.prefetch(`/level/${level.id}`);
    });
  }, [user, selectedTask.route, selectedWorld, levels, router]);

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");

    try {
      const response = await fetch(
        mode === "login" ? "/api/auth/login" : "/api/auth/signup",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email,
            password,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setAuthError(data.error || "Authentication failed");
        return;
      }

      setUser(data.user);
      setName("");
      setEmail("");
      setPassword("");
    } catch {
      setAuthError("Failed to authenticate. Please try again.");
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-center">
          <div className="text-4xl mb-4">⚔️</div>
          <p className="text-gray-200">Loading SQL Escape Dungeon...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-900 via-blue-900 to-slate-800 text-white">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <h1 className="text-4xl font-black tracking-tight">{PROJECT_NAME}</h1>
          <p className="mt-2 text-base text-blue-100">{PROJECT_TAGLINE}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-blue-200/40 bg-blue-500/20 px-3 py-1 text-xs font-semibold">
              College
            </span>
            <span className="rounded-full border border-blue-200/40 bg-blue-500/20 px-3 py-1 text-xs font-semibold">
              Ecommerce
            </span>
            <span className="rounded-full border border-blue-200/40 bg-blue-500/20 px-3 py-1 text-xs font-semibold">
              Restaurant
            </span>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
            <div className="rounded-xl border border-blue-200/20 bg-black/25 p-5">
              <h2 className="text-xl font-bold">Clear 3-Step Flow</h2>
              <ol className="mt-3 space-y-2 text-sm text-blue-100">
                <li>1. Create schema with CREATE TABLE</li>
                <li>2. Insert required sample rows</li>
                <li>3. Solve analytical query task</li>
              </ol>
              <p className="mt-3 text-xs text-blue-100/90">
                Each task requires schema creation with CREATE TABLE, enough
                INSERT data, then query validation.
              </p>
            </div>

            <form
              onSubmit={handleAuthSubmit}
              className="rounded-xl border border-blue-200/20 bg-white p-5 text-gray-900 shadow-2xl"
            >
              <div className="flex rounded-lg border border-gray-300 p-1 text-sm font-semibold">
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className={`flex-1 rounded-md px-3 py-2 ${
                    mode === "login"
                      ? "bg-blue-600 text-white"
                      : "text-gray-600"
                  }`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className={`flex-1 rounded-md px-3 py-2 ${
                    mode === "signup"
                      ? "bg-blue-600 text-white"
                      : "text-gray-600"
                  }`}
                >
                  Sign Up
                </button>
              </div>

              {mode === "signup" && (
                <div className="mt-4">
                  <label className="mb-1 block text-sm font-semibold">
                    Name
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    required
                  />
                </div>
              )}

              <div className="mt-4">
                <label className="mb-1 block text-sm font-semibold">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  required
                />
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-sm font-semibold">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  required
                />
              </div>

              {authError && (
                <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
                  {authError}
                </p>
              )}

              <button
                type="submit"
                className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
              >
                {mode === "login" ? "Login" : "Create Account"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 to-slate-800">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <header className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">
                🌐 {PROJECT_NAME}
              </h1>
              <p className="text-sm text-cyan-100 mb-1">{PROJECT_TAGLINE}</p>
              <p className="text-base text-gray-300">Welcome, {user.name}</p>
              <p className="text-sm text-gray-400">{user.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right bg-white bg-opacity-10 rounded-lg p-4 backdrop-blur">
                <p className="text-gray-300 text-sm">Total XP</p>
                <p className="text-5xl font-bold text-yellow-400">{totalXP}</p>
              </div>
              <button
                onClick={handleLogout}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <div className="mb-4 rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur">
          <p className="text-sm font-semibold text-white mb-3">
            Switch Task Environment
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {taskDestinations.map((task) => (
              <button
                key={`switch-${task.name}`}
                onClick={() => setSelectedWorld(task.world)}
                className={`rounded-lg border px-3 py-2 text-left transition ${
                  selectedWorld === task.world
                    ? "border-cyan-300 bg-cyan-500/20"
                    : "border-white/20 bg-slate-900/30 hover:bg-slate-900/50"
                }`}
              >
                <p className="text-sm font-semibold text-white">
                  {task.emoji} {task.name}
                </p>
                <p className="text-xs text-gray-300">Go to {task.name} task</p>
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between rounded-lg border border-cyan-300/30 bg-cyan-900/20 px-3 py-2">
            <p className="text-xs text-cyan-100">
              Selected environment:{" "}
              <span className="font-semibold">
                {selectedTask.emoji} {selectedTask.name}
              </span>
            </p>
            <button
              onClick={() => router.push(selectedTask.route)}
              className="rounded-md bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-600"
            >
              Enter Environment
            </button>
          </div>
        </div>

        <div className="bg-white text-slate-900 rounded-lg shadow-2xl p-8">
          <WorldMap
            levels={visibleLevels}
            completedLevelIds={completedLevelIds}
          />
        </div>
      </div>
    </div>
  );
}
