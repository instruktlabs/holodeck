using System;
using System.Collections.Generic;

namespace LastCrossing.Playable
{
    // World geometry and input live in the adapter. This model owns repeatable rules only.
    public sealed class SiegeSimulation
    {
        public enum Phase { Ready, Running, Victory, Breached }
        public sealed class Enemy
        {
            public int Id;
            public double Distance, BornAt, NextAttackAt;
            public double Speed;
            public int Health = 100;
            public bool Alive { get { return Health > 0; } }
        }
        public const int WaveSize = 24, MaxAlive = 12, MaximumGateHealth = 200;
        public readonly List<Enemy> Enemies = new List<Enemy>();
        public Phase State { get; private set; }
        public double Time { get; private set; }
        public double NextShotAt { get; private set; }
        public int GateHealth { get; private set; }
        public int Supplies { get; private set; }
        public int Spawned { get; private set; }
        public int Defeated { get; private set; }
        public int Shots { get; private set; }
        public readonly double PathLength;
        double nextSpawn;
        public int AliveCount { get { int n=0; foreach(var e in Enemies) if(e.Alive)n++; return n; } }
        public SiegeSimulation(double pathLength)
        {
            if(pathLength < 1 || double.IsNaN(pathLength) || double.IsInfinity(pathLength)) throw new ArgumentOutOfRangeException("pathLength");
            PathLength=pathLength; Reset();
        }
        public void Reset()
        {
            State=Phase.Ready; Time=0; NextShotAt=0; GateHealth=MaximumGateHealth;
            Supplies=6; Spawned=Defeated=Shots=0; nextSpawn=3; Enemies.Clear();
        }
        public bool Start() { if(State!=Phase.Ready)return false; State=Phase.Running; return true; }
        public void Tick(double dt)
        {
            if(dt<0 || dt>0.25 || double.IsNaN(dt))throw new ArgumentOutOfRangeException("dt");
            if(State!=Phase.Running)return;
            Time+=dt;
            if(Spawned<WaveSize && Time>=nextSpawn && AliveCount<MaxAlive)
            {
                int id=Spawned++;
                Enemies.Add(new Enemy{Id=id, BornAt=Time, Speed=1.60+(id*37%19)*0.02});
                nextSpawn=Time+2.5;
            }
            foreach(var e in Enemies)
            {
                if(!e.Alive)continue;
                double before=e.Distance;
                e.Distance=Math.Min(PathLength,e.Distance+e.Speed*dt);
                if(before<PathLength && e.Distance>=PathLength)e.NextAttackAt=Time+0.8;
                if(e.Distance>=PathLength && Time>=e.NextAttackAt)
                {
                    GateHealth=Math.Max(0,GateHealth-9);e.NextAttackAt=Time+1.4;
                    if(GateHealth==0){State=Phase.Breached;return;}
                }
            }
            CheckVictory();
        }
        public Enemy Find(int id) { return Enemies.Find(e=>e.Id==id && e.Alive); }
        // A miss consumes reload time. The adapter alone decides aim/range/occlusion.
        public bool TryShoot(int targetId,bool heavy=false,bool automatic=false)
        {
            if(State!=Phase.Running || Time<NextShotAt || (heavy && Supplies<2))return false;
            if(heavy)Supplies-=2;
            NextShotAt=Time+(heavy?1.9:automatic?2.2:0.95);Shots++;
            var target=Find(targetId);
            if(target!=null)
            {
                double center=target.Distance;
                Damage(target,heavy?120:65);
                if(heavy)foreach(var e in Enemies)if(e.Alive && e.Id!=targetId && Math.Abs(e.Distance-center)<2.8)Damage(e,65);
            }
            CheckVictory();return true;
        }
        void Damage(Enemy e,int damage) { e.Health=Math.Max(0,e.Health-damage);if(!e.Alive)Defeated++; }
        public bool TryRepair()
        {
            if(State!=Phase.Running || Supplies<3 || GateHealth>=MaximumGateHealth)return false;
            Supplies-=3;GateHealth=Math.Min(MaximumGateHealth,GateHealth+75);return true;
        }
        void CheckVictory() { if(State==Phase.Running && Spawned==WaveSize && AliveCount==0)State=Phase.Victory; }
    }
}
