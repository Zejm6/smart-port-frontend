export function KpiCard({title,value,helper,className}:{title:string;value:string;helper?:string;className?:string;}){
  return (
    <div className={`kpi ${className||""}`}>
      <div className="kpi-title">{title}</div>
      <div className="kpi-value mt-1">{value}</div>
      {helper && <div className="text-xs text-gray-500 mt-1">{helper}</div>}
    </div>
  );
}
