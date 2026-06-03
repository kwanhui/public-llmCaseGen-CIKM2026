"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { DisciplineCount, SectionRegenCount, DailyViewPoint, ResponsesByDiscipline } from "@/lib/analytics/queries";

const DISCIPLINE_LABELS: Record<string, string> = {
  finance: "Finance",
  marketing: "Marketing",
  social_work: "Social Work",
};

const SECTION_LABELS: Record<string, string> = {
  scenario: "Scenario",
  discussionQuestions: "Questions",
  modelAnswers: "Answers",
  rubric: "Rubric",
};

const PIE_COLORS = [
  "hsl(173, 58%, 49%)",
  "hsl(221, 83%, 60%)",
  "hsl(32, 95%, 56%)",
  "hsl(280, 65%, 60%)",
];

function ChartFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      <div className="h-64">{children}</div>
    </div>
  );
}

export function AuthoringTimeChart({ data }: { data: DisciplineCount[] }) {
  const formatted = data.map((d) => ({
    name: DISCIPLINE_LABELS[d.discipline] ?? d.discipline,
    minutes: d.meanAuthoringMinutes ?? 0,
    count: d.count,
  }));
  return (
    <ChartFrame title="Mean authoring time by discipline (min)">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formatted}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="name"
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
          />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="minutes"
            fill="hsl(var(--primary))"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function RegenCountChart({ data }: { data: SectionRegenCount[] }) {
  const formatted = data.map((d) => ({
    name: SECTION_LABELS[d.section] ?? d.section,
    count: d.count,
  }));
  return (
    <ChartFrame title="Section regenerations">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formatted}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <Bar dataKey="count" fill="hsl(32, 95%, 56%)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function StudentActivityChart({ data }: { data: DailyViewPoint[] }) {
  const formatted = data.map((d) => ({
    day: d.day.slice(5),
    views: d.views,
    responses: d.responsesSaved,
  }));
  return (
    <ChartFrame title="Student activity (7 days)">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formatted}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line
            type="monotone"
            dataKey="views"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 3 }}
            name="Views"
          />
          <Line
            type="monotone"
            dataKey="responses"
            stroke="hsl(32, 95%, 56%)"
            strokeWidth={2}
            dot={{ r: 3 }}
            name="Responses saved"
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function DisciplinePie({ data }: { data: DisciplineCount[] }) {
  const formatted = data.map((d) => ({
    name: DISCIPLINE_LABELS[d.discipline] ?? d.discipline,
    value: d.count,
  }));
  return (
    <ChartFrame title="Cases by discipline">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={formatted}
            dataKey="value"
            nameKey="name"
            outerRadius={90}
            label={(e) => `${e.name}: ${e.value}`}
          >
            {formatted.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function EngagementChart({ data }: { data: ResponsesByDiscipline[] }) {
  const formatted = data.map((d) => ({
    name: DISCIPLINE_LABELS[d.discipline] ?? d.discipline,
    Views: d.views,
    "Responses saved": d.responses,
  }));
  return (
    <ChartFrame title="Engagement by discipline">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formatted}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="Views" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Responses saved" fill="hsl(32, 95%, 56%)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
