"use client";

import { BarChart } from "@tremor/react";

interface LatencyBucket {
  label: string;
  count: number;
}

export default function LatencyChart({
  buckets,
}: {
  buckets: LatencyBucket[];
}) {
  return (
    <BarChart
      data={buckets}
      index="label"
      categories={["count"]}
      colors={["emerald"]}
      yAxisWidth={40}
      showLegend={false}
      className="h-48"
    />
  );
}
