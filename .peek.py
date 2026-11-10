import json, sys
d = json.load(open("content/experience.pt-BR.json", encoding="utf-8"))
for key in ("solutionPrinciples", "differentiators", "commercialModel"):
    print("=== " + key + " ===")
    print(json.dumps(d[key], ensure_ascii=False, indent=1))
print("=== presentation.site keys ===")
print(list(d["presentation"]["site"].keys()))
print("=== brand ===")
print(json.dumps(d["brand"], ensure_ascii=False, indent=1))
