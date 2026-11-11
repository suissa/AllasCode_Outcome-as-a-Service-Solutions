/** Identidade institucional fixa OaaS.Quest: navy + dourado. */
const STORAGE_KEY="oaas.quest.theme";
export function applyTheme(_id="abyss",persist=true){const root=document.documentElement;Array.from(root.classList).filter(name=>name.startsWith("oq-theme-")).forEach(name=>root.classList.remove(name));root.classList.add("oq-theme-abyss");root.dataset.theme="dark";if(persist){try{localStorage.setItem(STORAGE_KEY,"abyss")}catch{}}return{id:"abyss",label:"Navy + dourado"}}
export function applyStoredTheme(){return applyTheme("abyss",false)}
export function buildThemeSwitcher(){document.querySelector(".theme-switcher")?.remove()}