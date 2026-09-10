"use client";

import { useEffect, useState } from "react";
import { getResponseQueue } from "@/app/services/threatService";

interface QueueItem {
  status: string;
  count: number;
}

export default function ResponseQueue() {
  const [queue, setQueue] = useState<QueueItem[]>([]);

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    try {
      const data = await getResponseQueue();
      setQueue(data);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-cyan-400/35 p-5 shadow-[0_0_28px_rgba(34,211,238,0.12),inset_0_0_45px_rgba(34,211,238,0.05)] sm:p-6"
      style={{
        background:
          "linear-gradient(145deg, rgba(20,58,105,0.82), rgba(7,26,58,0.96) 65%, rgba(4,15,35,0.98))",
      }}
    >
      <div className="pointer-events-none absolute right-0 top-0 h-40 w-80 rounded-bl-full bg-cyan-400/20 blur-2xl" />

      <h2 className="relative z-10 mb-5 text-lg font-semibold text-white sm:text-xl">
        Response Queue
      </h2>

      <div className="relative z-10">
        {queue.map((item) => (
          <div
            key={item.status}
            className="mb-3 flex items-center justify-between rounded-lg border border-white/10 bg-[#06152c]/85 p-3"
          >
            <span className="text-slate-200">{item.status}</span>

            <span className="font-semibold text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]">
              {item.count}
            </span>
          </div>
        ))}

        {queue.length === 0 && (
          <p className="text-sm text-slate-400">
            No items in the response queue.
          </p>
        )}
      </div>
    </div>
  );
}