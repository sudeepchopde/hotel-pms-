
import React from 'react';
import { Terminal, Lock, Globe, Server, Code, Database, Zap, ShieldCheck, Share2, RotateCw, Key, BrainCircuit, ShieldAlert } from 'lucide-react';

const BlueprintView: React.FC = () => {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-12 pb-24">
      <header>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Technical Blueprint: Phase 7</h2>
        <p className="text-slate-500 mt-2 font-medium">Advanced Fraud Prevention & Verification Throttling.</p>
      </header>

      {/* Security Audit Table Schema */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-red-600">
          <ShieldAlert className="w-6 h-6" />
          <h3 className="text-xl font-bold tracking-tight">1. Security Audit Schema (PostgreSQL)</h3>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
          Tracks every verification attempt across the property to detect patterns of room service fraud or enumeration attacks.
        </p>
        <div className="bg-slate-900 rounded-3xl p-8 font-mono text-xs text-indigo-300 overflow-x-auto border border-slate-800 shadow-2xl">
          <pre>{`-- SQL Schema for Verification Auditing
CREATE TABLE verification_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id VARCHAR(10) NOT NULL,
    input_surname VARCHAR(100),
    status VARCHAR(10) CHECK (status IN ('SUCCESS', 'FAIL', 'LOCKED')),
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_room_ip_recent ON verification_attempts (room_id, ip_address, created_at);`}</pre>
        </div>
      </section>

      {/* Backend Security Logic Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-indigo-600">
          <Lock className="w-6 h-6" />
          <h3 className="text-xl font-bold tracking-tight">2. Throttling & Circuit Breaking (FastAPI)</h3>
        </div>
        <div className="bg-slate-900 rounded-3xl p-8 font-mono text-xs text-emerald-400 overflow-x-auto border border-slate-800 shadow-xl">
          <pre>{`# security_provider.py - Fraud Prevention Logic
from fastapi import FastAPI, HTTPException, status, Request
from datetime import datetime, timedelta

@app.post("/api/v1/verify-guest")
async def verify_guest(req: VerificationRequest, request: Request):
    ip = request.client.host
    
    # 1. Check for Active Lockout
    if is_room_locked(req.room_number):
        log_attempt(req.room_number, req.last_name, "LOCKED", ip)
        raise HTTPException(status_code=423, detail="Room locked due to multiple failures.")

    # 2. Rate Limit Check (Throttling)
    # Logic: > 3 fails in 10 minutes triggers a 429 and Room Lock
    ten_mins_ago = datetime.now() - timedelta(minutes=10)
    fail_count = db.verification_attempts.count({
        "room_id": req.room_number,
        "ip_address": ip,
        "status": "FAIL",
        "created_at": {"$gt": ten_mins_ago}
    })

    if fail_count >= 3:
        flag_room_lock(req.room_number)
        notify_front_desk(req.room_number, "Potential Fraud Detected")
        raise HTTPException(status_code=429, detail="Too many attempts. Contact Front Desk.")

    # 3. Standard Verification...
    result = perform_validation(req.room_number, req.last_name)
    log_attempt(req.room_number, req.last_name, "SUCCESS" if result else "FAIL", ip)
    
    return result`}</pre>
        </div>
      </section>

      {/* Zero-Trust Architecture */}
      <section className="bg-indigo-900 rounded-[3rem] p-12 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Zap className="w-64 h-64" />
        </div>
        <div className="relative z-10 space-y-6">
          <h3 className="text-3xl font-black tracking-tight">Zero-Trust Distribution Architecture</h3>
          <p className="text-indigo-100 text-lg max-w-2xl leading-relaxed font-medium">
            SyncGuard's ordering pipeline is now fortified with **Intelligent Throttling**. By combining IP-based rate limiting with Unit-level circuit breaking, we've eliminated the possibility of credential brute-forcing while maintaining a frictionless guest experience.
          </p>
          <div className="flex flex-wrap gap-4 pt-4">
            <div className="px-5 py-2 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-[0.1em] border border-white/20 backdrop-blur-md">PostgreSQL Audit Trails</div>
            <div className="px-5 py-2 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-[0.1em] border border-white/20 backdrop-blur-md">Unit-Level Circuit Breaking</div>
            <div className="px-5 py-2 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-[0.1em] border border-white/20 backdrop-blur-md">Real-time Fraud Webhooks</div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default BlueprintView;
