using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;

public static class SiegeMaterialAudit
{
    [Serializable] class Entry { public string asset, material, shader; public bool supported; public string[] properties; }
    [Serializable] class Report { public string colorSpace; public Entry[] materials; }
    public static void Run()
    {
        var rows = Directory.GetFiles("Assets/SiegeBundle", "*.glb").SelectMany(file =>
            AssetDatabase.LoadAllAssetsAtPath(file).OfType<Material>().Select(m => {
                var values = Enumerable.Range(0, m.shader.GetPropertyCount()).Select(i => {
                    var name=m.shader.GetPropertyName(i);
                    var type=m.shader.GetPropertyType(i);
                    if(type==ShaderPropertyType.Color) return name+"="+m.GetColor(name).ToString("F6");
                    if(type==ShaderPropertyType.Float || type==ShaderPropertyType.Range) return name+"="+m.GetFloat(name).ToString(System.Globalization.CultureInfo.InvariantCulture);
                    if(type==ShaderPropertyType.Texture) return name+"="+(m.GetTexture(name)?.name ?? "none");
                    return null;
                }).Where(v=>v!=null).ToArray();
                return new Entry {asset=file,material=m.name,shader=m.shader.name,supported=m.shader.isSupported,properties=values};
            })).ToArray();
        if(rows.Length==0) throw new Exception("No imported materials found");
        Directory.CreateDirectory("Evidence");
        File.WriteAllText("Evidence/material-audit-"+PlayerSettings.colorSpace+".json",JsonUtility.ToJson(new Report{colorSpace=PlayerSettings.colorSpace.ToString(),materials=rows},true));
    }
}
