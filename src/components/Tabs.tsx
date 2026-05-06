type Props = {
  active: "optimize"|"conflicts"|"history";
  onChange: (t: Props["active"])=>void;
};
export function Tabs({active,onChange}:Props){
  return (
    <div className="flex gap-2">
      <button className={`tab ${active==="optimize"?"tab-active":""}`} onClick={()=>onChange("optimize")}>Optimize</button>
      <button className={`tab ${active==="conflicts"?"tab-active":""}`} onClick={()=>onChange("conflicts")}>Conflicts</button>
      <button className={`tab ${active==="history"?"tab-active":""}`} onClick={()=>onChange("history")}>History</button>
    </div>
  );
}
