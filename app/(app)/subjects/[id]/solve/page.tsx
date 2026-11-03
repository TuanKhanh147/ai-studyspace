import Solver from '@/components/Solver';

export default function SolvePage({ params }: { params: { id: string } }) {
  return <Solver subjectId={params.id} />;
}
