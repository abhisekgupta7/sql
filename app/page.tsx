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
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-linear-to-br from-slate-900 via-blue-900 to-slate-800 px-4">
        <div className="pointer-events-none absolute -top-28 -left-20 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="text-center">
          <div className="text-6xl md:text-7xl mb-4 animate-bounce">⚔️</div>
          <p className="text-base md:text-lg text-gray-200 font-medium">Loading SQL Playground...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-linear-to-br from-slate-900 via-blue-900 to-slate-800 text-white">
        <div className="pointer-events-none absolute -top-36 left-0 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-1/3 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
          <h1 className="text-3xl font-black tracking-tight md:text-5xl">{PROJECT_NAME}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-blue-100 md:text-base">{PROJECT_TAGLINE}</p>

          <div className="mt-6 flex flex-wrap gap-3 items-center">
            <span className="text-sm md:text-base font-semibold text-blue-200">Available Schemas:</span>
            <span className="rounded-full border border-blue-300/60 bg-blue-500/30 px-3 py-1.5 text-xs md:text-sm font-semibold hover:bg-blue-500/40 transition">
              🎓 College
            </span>
            <span className="rounded-full border border-blue-300/60 bg-blue-500/30 px-3 py-1.5 text-xs md:text-sm font-semibold hover:bg-blue-500/40 transition">
              🛒 Ecommerce
            </span>
            <span className="rounded-full border border-blue-300/60 bg-blue-500/30 px-3 py-1.5 text-xs md:text-sm font-semibold hover:bg-blue-500/40 transition">
              🍽️ Restaurant
            </span>
          </div>

          <div className="mt-8 grid gap-6 md:mt-10 lg:grid-cols-[1.1fr_1fr]">
            <div className="rounded-xl border border-blue-200/20 bg-black/30 p-6 backdrop-blur md:p-8">
              <h2 className="text-xl font-bold text-white md:text-2xl">Clear 3-Step Flow</h2>
              <ol className="mt-4 space-y-3 text-sm font-medium text-blue-100 md:text-base">
                <li className="flex items-start gap-3"><span className="text-blue-300 font-bold min-w-6">1.</span><span>Create schema with CREATE TABLE statements</span></li>
                <li className="flex items-start gap-3"><span className="text-blue-300 font-bold min-w-6">2.</span><span>Insert required sample data rows</span></li>
                <li className="flex items-start gap-3"><span className="text-blue-300 font-bold min-w-6">3.</span><span>Solve the analytical query task</span></li>
              </ol>
              <p className="mt-4 text-xs leading-relaxed text-blue-100/80 md:text-sm">
                Each challenge requires proper schema design, sufficient test data, and correct query validation to complete.
              </p>
            </div>

            <form
              onSubmit={handleAuthSubmit}
              className="rounded-xl border border-blue-200/30 bg-white/95 p-6 text-gray-900 shadow-2xl backdrop-blur md:p-8"
            >
              <div className="flex gap-1 rounded-lg border-2 border-gray-200 p-1.5 text-sm font-semibold">
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className={`flex-1 rounded-md px-3 py-2.5 transition-colors ${
                    mode === "login"
                      ? "bg-blue-600 text-white shadow"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className={`flex-1 rounded-md px-3 py-2.5 transition-colors ${
                    mode === "signup"
                      ? "bg-blue-600 text-white shadow"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  Sign Up
                </button>
              </div>

              {mode === "signup" && (
                <div className="mt-4">
                  <label className="mb-1 block text-sm font-semibold text-gray-700">
                    Full Name
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full rounded-lg border-2 border-gray-200 px-3 py-2.5 outline-hidden transition focus:border-blue-500"
                    required
                  />
                </div>
              )}

              <div className="mt-4">
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border-2 border-gray-200 px-3 py-2.5 outline-hidden transition focus:border-blue-500"
                  required
                />
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  className="w-full rounded-lg border-2 border-gray-200 px-3 py-2.5 outline-hidden transition focus:border-blue-500"
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
                className="mt-5 w-full rounded-lg bg-linear-to-r from-blue-600 to-cyan-600 px-4 py-2.5 font-semibold text-white transition hover:from-blue-700 hover:to-cyan-700"
              >
                {mode === "login" ? "Login to Dashboard" : "Create Account"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 md:py-8">
        <header className="mb-6 md:mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6">
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-white mb-2">
                🌐 {PROJECT_NAME}
              </h1>
              <p className="text-xs md:text-sm text-cyan-200 mb-3 line-clamp-2">{PROJECT_TAGLINE}</p>
              <div className="space-y-1">
                <p className="text-sm md:text-base text-gray-200 font-medium">Welcome back, <span className="font-bold text-cyan-300">{user.name}</span></p>
                <p className="text-xs md:text-sm text-gray-400">{user.email}</p>
              </div>
            </div>
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center md:gap-4">
              <div className="w-full rounded-xl border border-yellow-400/30 bg-linear-to-br from-yellow-500/20 to-orange-500/20 p-4 text-center backdrop-blur sm:w-auto sm:text-right">
                <p className="text-gray-300 text-xs md:text-sm font-medium">Total XP</p>
                <p className="text-3xl md:text-4xl lg:text-5xl font-bold text-yellow-300 mt-1">{totalXP}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full sm:w-auto rounded-lg border-2 border-white/30 px-4 py-2.5 md:py-2 text-sm font-semibold text-white bg-white/5 hover:bg-white/10 hover:border-white/50 transition-all duration-200 active:scale-95"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <div className="mb-6 rounded-xl border border-white/15 bg-linear-to-br from-white/10 to-white/5 p-5 backdrop-blur-md md:mb-8 md:p-6">
          <h2 className="text-base md:text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span>🌍</span> Switch Task Environment
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {taskDestinations.map((task) => (
              <button
                key={`switch-${task.name}`}
                onClick={() => setSelectedWorld(task.world)}
                className={`rounded-lg border-2 px-4 py-3 text-left transition-all duration-200 hover:scale-[1.02] active:scale-95 md:py-2.5 ${
                  selectedWorld === task.world
                    ? "border-cyan-400 bg-cyan-500/30 shadow-lg shadow-cyan-500/20"
                    : "border-white/20 bg-slate-900/40 hover:bg-slate-800/50 hover:border-white/40"
                }`}
              >
                <p className="text-base md:text-sm font-bold text-white">
                  {task.emoji} {task.name}
                </p>
                <p className="text-xs text-gray-300 mt-1">{task.description}</p>
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-lg border-2 border-cyan-400/40 bg-linear-to-r from-cyan-900/30 to-cyan-800/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:py-2.5">
            <p className="text-xs md:text-sm text-cyan-100 font-medium">
              Current:{" "}
              <span className="font-bold text-cyan-300">
                {selectedTask.emoji} {selectedTask.name}
              </span>
            </p>
            <button
              onClick={() => router.push(selectedTask.route)}
              className="min-h-10 w-full rounded-lg bg-linear-to-r from-cyan-500 to-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:from-cyan-600 hover:to-cyan-700 hover:shadow-lg active:scale-95 sm:w-auto md:min-h-0 md:py-2"
            >
              🚀 Enter {selectedTask.name}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/20 bg-linear-to-br from-white to-gray-50 p-4 text-slate-900 shadow-2xl sm:p-6 md:p-8">
          <div className="mb-6">
            <h2 className="text-lg md:text-2xl font-bold text-slate-900 mb-1">📊 Available Challenges</h2>
            <p className="text-sm text-gray-600">Select a challenge to begin learning SQL</p>
          </div>
          <WorldMap
            levels={visibleLevels}
            completedLevelIds={completedLevelIds}
          />
        </div>
      </div>
    </div>
  );
}
