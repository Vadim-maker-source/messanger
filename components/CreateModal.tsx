"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Shield, Users, MessageCircle, Globe, Camera } from "lucide-react";
import { createServer } from "@/app/lib/api/chat";

export default function CreateModal({ isOpen, onClose, type }: any) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      if (type === 'SERVER') {
        await createServer({
          name,
          access: "PUBLIC"
        });
      }
      // Добавить логику для других типов
      onClose();
    } catch (e) {
      alert("Ошибка при создании");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
          />
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="w-full max-w-md bg-[#121214] border border-white/10 rounded-[32px] overflow-hidden relative z-10 shadow-2xl"
          >
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  {type === 'SERVER' ? <Shield className="text-orange-500" /> : <MessageCircle className="text-violet-500" />}
                  {type === 'SERVER' ? 'Создать Сервер' : 'Новый Чат'}
                </h2>
                <button onClick={onClose} className="text-white/20 hover:text-white"><X /></button>
              </div>

              <div className="space-y-6">
                {/* Аватар */}
                <div className="flex justify-center">
                  <div className="w-24 h-24 rounded-3xl bg-white/5 border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-white/20 hover:border-violet-500/50 hover:text-violet-500 cursor-pointer transition-all">
                    <Camera size={28} />
                    <span className="text-[10px] mt-2 font-bold uppercase">Загрузить</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/40 uppercase tracking-wider ml-1">Название</label>
                  <input 
                    value={name} onChange={(e) => setName(e.target.value)}
                    placeholder={type === 'SERVER' ? "Мой крутой сервер" : "Имя группы или канала"}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:border-violet-500 outline-none transition-all"
                  />
                </div>

                <button
                  onClick={handleCreate}
                  disabled={!name || loading}
                  className={`w-full py-4 rounded-2xl font-bold transition-all shadow-lg active:scale-95
                    ${type === 'SERVER' 
                      ? 'bg-orange-500 hover:bg-orange-600 text-black shadow-orange-500/20' 
                      : 'bg-violet-600 hover:bg-violet-700 text-white shadow-violet-500/20'}`}
                >
                  {loading ? 'Создаем...' : 'Создать сейчас'}
                </button>
              </div>
            </div>
            
            {/* Декоративная полоса снизу */}
            <div className={`h-1.5 w-full ${type === 'SERVER' ? 'bg-orange-500' : 'bg-violet-600'}`} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}