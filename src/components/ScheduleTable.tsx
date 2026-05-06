type Row = { id:number; date:string; port:"Kotor"|"Bar"; pax:number };

export function ScheduleTable({rows}:{rows:Row[]}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-gray-500">
          <tr className="[&>th]:py-2 [&>th]:pr-3">
            <th>ID</th><th>Date</th><th>Port</th><th>Pax</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map(r=>(
            <tr key={r.id} className="[&>td]:py-2 [&>td]:pr-3">
              <td>{r.id}</td>
              <td>{r.date}</td>
              <td>
                <span className={`badge ${r.port==='Kotor'?'badge-kotor':'badge-bar'}`}>{r.port}</span>
              </td>
              <td>{r.pax.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-xs text-gray-500 mt-3">
        Tip: connect to <code>GET /schedule</code> and <code>GET /kpis</code> to populate this table and KPI cards.
      </div>
    </div>
  );
}
