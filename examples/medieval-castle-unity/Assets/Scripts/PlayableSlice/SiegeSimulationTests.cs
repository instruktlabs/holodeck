using System;
using LastCrossing.Playable;

public static class SiegeSimulationTests
{
    static void Require(bool value,string message) { if(!value)throw new Exception(message); }
    public static void Main()
    {
        var loss=new SiegeSimulation(48);loss.Start();
        for(int i=0;i<10000 && loss.State==SiegeSimulation.Phase.Running;i++){loss.Tick(.02);Require(loss.AliveCount<=12,"Alive cap exceeded");}
        Require(loss.State==SiegeSimulation.Phase.Breached && loss.GateHealth==0,"Unattended wave must breach gate");
        var win=new SiegeSimulation(48);win.Start();
        for(int i=0;i<12000 && win.State==SiegeSimulation.Phase.Running;i++)
        {
            win.Tick(.02);var target=win.Enemies.Find(e=>e.Alive);if(target!=null)win.TryShoot(target.Id);
        }
        Require(win.State==SiegeSimulation.Phase.Victory && win.Defeated==24,"Defended wave must be winnable");
        Require(!win.TryRepair(),"Cannot repair after victory");
        win.Reset();Require(win.State==SiegeSimulation.Phase.Ready && win.Enemies.Count==0 && win.Supplies==6 && win.Shots==0,"Restart leaked state");
        win.Start();while(win.GateHealth==200)win.Tick(.02);
        int damaged=win.GateHealth;Require(win.TryRepair() && win.Supplies==3 && win.GateHealth==Math.Min(200,damaged+75),"Repair cost/heal incorrect");
        while(win.GateHealth==200)win.Tick(.02);Require(win.TryRepair() && win.Supplies==0,"Second repair failed");
        Require(!win.TryRepair() && !win.TryShoot(-1,true),"Supplies can be overspent");
        var a=new SiegeSimulation(48);var b=new SiegeSimulation(48);a.Start();b.Start();
        for(int i=0;i<2000;i++){a.Tick(.02);b.Tick(.02);}
        Require(a.GateHealth==b.GateHealth && a.Spawned==b.Spawned,"Deterministic replay mismatch");
        for(int i=0;i<a.Enemies.Count;i++)Require(a.Enemies[i].Distance==b.Enemies[i].Distance,"Enemy replay mismatch");
        Console.WriteLine("PASS: victory, breach, alive cap, restart, supplies and deterministic replay");
    }
}
