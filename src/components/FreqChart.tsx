import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// Recharts는 무겁기 때문에 이 컴포넌트만 React.lazy 로 분리해 별도 청크로 로드한다.
export default function FreqChart({ data }: { data: { n: number; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: -16 }}>
        <XAxis dataKey="n" tick={{ fontSize: 11, fill: "#8e8e93" }} interval={4} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#8e8e93" }} width={28} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: "rgba(120,120,128,0.12)" }} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#ff375f" />
      </BarChart>
    </ResponsiveContainer>
  );
}
