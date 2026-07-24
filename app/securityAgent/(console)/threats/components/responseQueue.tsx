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
    <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
      <h2 className="font-semibold mb-5">
        Response Queue
      </h2>

      {queue.map((item) => (
        <div
          key={item.status}
          className="flex justify-between bg-[#020617] border border-slate-700 rounded-lg p-3 mb-3"
        >
          <span>{item.status}</span>

          <span className="text-yellow-400">
            {item.count}
          </span>
        </div>
      ))}
    </div>
  );
}