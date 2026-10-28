// Copyright Epic Games, Inc. All Rights Reserved.

using UnrealBuildTool;

public class ToolchainValidation : ModuleRules
{
	public ToolchainValidation(ReadOnlyTargetRules Target) : base(Target)
	{
		// Small qualification module: avoid mapping the 2.49 GB editor PCH
		// while other development jobs occupy most of this workstation's RAM.
		PCHUsage = PCHUsageMode.NoPCHs;
	
		PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine", "InputCore", "EnhancedInput", "AnimGraphRuntime" });

		PrivateDependencyModuleNames.AddRange(new string[] { "Json", "JsonUtilities" });

		// Uncomment if you are using Slate UI
		// PrivateDependencyModuleNames.AddRange(new string[] { "Slate", "SlateCore" });
		
		// Uncomment if you are using online features
		// PrivateDependencyModuleNames.Add("OnlineSubsystem");

		// To include OnlineSubsystemSteam, add it to the plugins section in your uproject file with the Enabled attribute set to true
	}
}

