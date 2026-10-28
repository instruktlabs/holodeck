#include "WeaponTriggerFixture.h"
#include <cstdio>
// Standalone replay of the shared trigger fixtures through the native headers (pipeline/check-trigger-native.ps1).
int main(){FString S;const bool Ok=WeaponTrigger::ReplayFixtures(S);wprintf(L"%ls %ls\n",Ok?L"PASS":L"FAIL",*S);return Ok?0:1;}
