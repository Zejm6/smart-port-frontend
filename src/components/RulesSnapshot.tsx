export function RulesSnapshot(){
  return (
    <div>
      <div className="text-sm font-semibold mb-3">Rules snapshot</div>
      <ul className="text-sm text-gray-700 space-y-1">
        <li>• Target Kotor share: <b>70%</b></li>
        <li>• Big ship threshold: <b>≥ 300m or ≥ 3500 pax</b></li>
        <li>• Big ships → <span className="font-semibold">Bar</span></li>
        <li>• Max calls/day/port: <b>3</b></li>
      </ul>
    </div>
  );
}
