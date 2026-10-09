import BureauAuthGate, { BureauSeanceReserve } from '../components/BureauAuthGate';
import { BureauRelancesAutonome } from '../components/bureau/BureauRelancesTab';

export default function BureauRelancesPage() {
  return (
    <BureauAuthGate>
      <BureauSeanceReserve>
        <BureauRelancesAutonome />
      </BureauSeanceReserve>
    </BureauAuthGate>
  );
}
