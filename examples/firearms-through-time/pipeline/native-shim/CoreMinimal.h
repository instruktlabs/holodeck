#pragma once
// Minimal stand-ins for the Unreal types the header-only weapon code uses, so it can be compiled and run outside the engine.
#include <string>
#include <vector>
#include <cmath>
#include <cstdint>
#include <cstdarg>
#include <cwchar>
#include <limits>
typedef wchar_t TCHAR;
#define TEXT(x) L##x
typedef int32_t int32;typedef uint32_t uint32;typedef uint8_t uint8;
#define MAX_int32 INT32_MAX
#define UE_ARRAY_COUNT(a) (sizeof(a)/sizeof((a)[0]))
template<typename T> struct TNumericLimits{static constexpr T Max(){return std::numeric_limits<T>::max();}};
namespace ESearchCase{enum Type{CaseSensitive,IgnoreCase};}
struct FString{
 std::wstring S;
 FString(){} FString(const TCHAR* s):S(s?s:L""){} FString(std::wstring s):S(std::move(s)){}
 const TCHAR* operator*()const{return S.c_str();}
 bool IsEmpty()const{return S.empty();}
 bool Equals(const FString& o,ESearchCase::Type)const{return S==o.S;}
 bool operator==(const FString& o)const{return S==o.S;}
 bool operator!=(const FString& o)const{return S!=o.S;}
 FString operator+(const FString& o)const{return FString(S+o.S);}
 static FString Printf(const TCHAR* f,...){wchar_t b[8192];va_list a;va_start(a,f);vswprintf(b,8192,f,a);va_end(a);return FString(b);}
};
struct FName{std::wstring S;FName(const TCHAR* s):S(s){}bool operator==(const FName& o)const{return _wcsicmp(S.c_str(),o.S.c_str())==0;}FString ToString()const{return FString(S);}};
template<typename T> struct TArray{std::vector<T> V;int32 Num()const{return (int32)V.size();}void Add(const T& x){V.push_back(x);}void RemoveAt(int32 i){V.erase(V.begin()+i);}T& operator[](int32 i){return V[i];}const T& operator[](int32 i)const{return V[i];}};
struct FMath{
 template<typename T> static T Min(T a,T b){return a<b?a:b;}
 template<typename T> static T Max(T a,T b){return a>b?a:b;}
 template<typename T> static T Min3(T a,T b,T c){return Min(Min(a,b),c);}
 template<typename T> static T Abs(T a){return a<0?-a:a;}
 template<typename T> static T Clamp(T x,T a,T b){return x<a?a:x>b?b:x;}
 static double Exp(double x){return std::exp(x);}
 static bool IsFinite(double x){return std::isfinite(x);}
 static double CeilToDouble(double x){return std::ceil(x);}
};
struct FVector2D{double X=0,Y=0;FVector2D(){}FVector2D(double x,double y):X(x),Y(y){}static const FVector2D ZeroVector;};
inline const FVector2D FVector2D::ZeroVector{0,0};
struct FTCHARToUTF8{std::string U;explicit FTCHARToUTF8(const TCHAR* s){for(;*s;s++){uint32 c=*s;if(c<0x80)U+=char(c);else if(c<0x800){U+=char(0xC0|(c>>6));U+=char(0x80|(c&63));}else{U+=char(0xE0|(c>>12));U+=char(0x80|((c>>6)&63));U+=char(0x80|(c&63));}}}int32 Length()const{return (int32)U.size();}const char* Get()const{return U.c_str();}};
