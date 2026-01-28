"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"

interface ThreatSeverityChartProps {
  data: {
    critical: number
    high: number
    medium: number
    low: number
    info: number
  }
}

export function ThreatSeverityChart({ data }: ThreatSeverityChartProps) {
  const chartData = [
    { name: "Critical", value: data.critical, color: "#ef4444" },
    { name: "High", value: data.high, color: "#f97316" },
    { name: "Medium", value: data.medium, color: "#eab308" },
    { name: "Low", value: data.low, color: "#22c55e" },
    { name: "Info", value: data.info, color: "#3b82f6" },
  ].filter((item) => item.value > 0)

  const total = chartData.reduce((sum, item) => sum + item.value, 0)

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Threats by Severity</CardTitle>
          <CardDescription>Distribution of detected threats</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <p className="text-muted-foreground">No threats detected</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Threats by Severity</CardTitle>
        <CardDescription>Distribution of detected threats</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
