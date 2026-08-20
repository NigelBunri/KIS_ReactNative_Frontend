import React from 'react';
import EducationV2DiscoverPage from '@/screens/broadcast/education/EducationV2DiscoverPage';

type Props = {
  searchTerm?: string;
  searchContext?: string;
  openContentId?: string;
};

export default function BroadcastEducationPage({ searchTerm, searchContext, openContentId }: Props) {
  return (
    <EducationV2DiscoverPage
      searchTerm={searchTerm}
      searchContext={searchContext}
      openContentId={openContentId}
    />
  );
}
