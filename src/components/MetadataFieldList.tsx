import type { MetadataField } from "../features/metadata/types";

type MetadataFieldListProps = {
  fields: MetadataField[];
  selected: ReadonlySet<string>;
  onToggle: (fieldId: string) => void;
};

const SECTIONS: Array<{ key: string; title: string; kinds: MetadataField["kind"][] }> = [
  { key: "exif", title: "EXIF / GPS", kinds: ["tiff", "exif", "gps"] },
  { key: "text", title: "Texto (PNG)", kinds: ["text"] },
  { key: "block", title: "IPTC / XMP / Outros", kinds: ["block"] },
];

export function MetadataFieldList({ fields, selected, onToggle }: MetadataFieldListProps) {
  if (fields.length === 0) {
    return <p className="text-sm italic">Nenhum metadado encontrado.</p>;
  }

  return (
    <div className="space-y-4">
      {SECTIONS.map((section) => {
        const sectionFields = fields.filter((f) => section.kinds.includes(f.kind));
        if (sectionFields.length === 0) return null;
        return (
          <div key={section.key} data-testid={`metadata-section-${section.key}`}>
            <h3 className="mb-1 border-b border-retro-shadow font-bold text-xs uppercase">{section.title}</h3>
            <ul className="space-y-1">
              {sectionFields.map((field) => (
                <li key={field.id} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    id={`field-${field.id}`}
                    checked={selected.has(field.id)}
                    onChange={() => onToggle(field.id)}
                    className="mt-1"
                  />
                  <label htmlFor={`field-${field.id}`} className="flex-1">
                    <span className="font-bold">{field.label}</span>
                    {": "}
                    <span>{field.value}</span>
                    {field.note && <span className="block text-xs italic text-retro-shadow">{field.note}</span>}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
