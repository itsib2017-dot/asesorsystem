"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  accent?: "blue" | "teal" | "amber" | "emerald";
  icon?: React.ReactNode;
}

const ACCENT_MAP = {
  blue: "bg-blue-50 text-blue-600 border-blue-100",
  teal: "bg-teal-50 text-teal-700 border-teal-100",
  amber: "bg-amber-50 text-amber-700 border-amber-100",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
};

export function StatsCard({
  title,
  value,
  subtitle,
  trend = "up",
  trendLabel,
  accent = "blue",
  icon,
}: StatsCardProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      whileHover={prefersReducedMotion ? undefined : { y: -5 }}
      transition={{ duration: 0.15 }}
      className="glass-card p-6 rounded-2xl flex flex-col justify-between"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {title}
          </span>
          <div className="text-2xl font-bold text-slate-900 mt-2 tracking-tight">
            {value}
          </div>
        </div>
        {icon && (
          <div
            className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${ACCENT_MAP[accent]}`}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs">
        <span className="text-slate-500">{subtitle}</span>
        {trendLabel && (
          <span
            className={`inline-flex items-center gap-0.5 font-medium ${
              trend === "down" ? "text-amber-700" : "text-emerald-700"
            }`}
          >
            {trend === "down" ? (
              <ArrowDownRight className="w-3.5 h-3.5" />
            ) : (
              <ArrowUpRight className="w-3.5 h-3.5" />
            )}
            {trendLabel}
          </span>
        )}
      </div>
    </motion.div>
  );
}
