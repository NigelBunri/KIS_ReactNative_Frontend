import React from 'react';
import SectionCard from '@/screens/tabs/profile/components/SectionCard';
import type { ItemType } from '@/screens/tabs/profile/profile.types';

type SectionDescriptor = {
  key: string;
  title: string;
  items: any[];
};

type Props = {
  sections: SectionDescriptor[];
  onAdd: (type: ItemType) => void;
  onEdit: (type: ItemType, item: any) => void;
  onDelete: (type: ItemType, id: string) => void;
};

export default function SectionCardsList({ sections, onAdd, onEdit, onDelete }: Props) {
  return (
    <>
      {sections.map((section) => (
        <SectionCard
          key={section.key}
          title={section.title}
          type={section.key as ItemType}
          items={section.items}
          onAdd={() => onAdd(section.key as ItemType)}
          onEdit={(item) => onEdit(section.key as ItemType, item)}
          onDelete={(id) => onDelete(section.key as ItemType, id)}
        />
      ))}
    </>
  );
}
