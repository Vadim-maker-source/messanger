"use client";
import { useState, useEffect } from "react";
import { Search, X, Check, UserPlus } from "lucide-react";
import { getInviteSuggestions } from "@/app/lib/api/chat";

export default function UserSelector({ onSelect, selectedIds }: any) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      const data = await getInviteSuggestions(query);
      setSuggestions(data);
      setLoading(false);
    };
    const timer = setTimeout(fetchUsers, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const toggleUser = (userId: string) => {
    if (selectedIds.includes(userId)) {
      onSelect(selectedIds.filter((id: string) => id !== userId));
    } else {
      onSelect([...selectedIds, userId]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={16} />
        <input 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по username..."
          className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm outline-none focus:border-orange-500/50 transition-all"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {suggestions.map((u) => {
          const isSelected = selectedIds.includes(u.id);
          return (
            <button
              key={u.id}
              onClick={() => toggleUser(u.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all text-xs
                ${isSelected ? 'bg-orange-500 border-orange-500 text-black' : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'}`}
            >
              {u.avatarUrl && <img src={u.avatarUrl} className="w-4 h-4 rounded-full" />}
              <span>{u.username}</span>
              {isSelected ? <X size={12} /> : <Check size={12} className="opacity-20" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}