import Button from '../atoms/Button.jsx';

export default function HeaderBar({ onOpenRules }) {
  return (
    <header className="page-header">
      <div className="header-row">
        <div>
          <h1 className="header-title">Mobile Automator Control Plane</h1>
        </div>
        <Button type="button" variant="ghost" onClick={onOpenRules}>
          Info: Mağaza Kuralları
        </Button>
      </div>
    </header>
  );
}
