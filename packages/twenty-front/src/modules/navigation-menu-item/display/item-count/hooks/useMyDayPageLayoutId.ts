import { useQuery } from '@apollo/client/react';

import { MY_DAY_COUNT_SOURCE } from '@/navigation-menu-item/display/item-count/constants/MyDayCountSource';
import { FIND_STANDALONE_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS } from '@/navigation-menu-item/display/item-count/graphql/queries/findStandalonePageLayoutUniversalIdentifiers';

type FindStandalonePageLayoutUniversalIdentifiersResult = {
  getPageLayouts: { id: string; universalIdentifier: string }[];
};

export const useMyDayPageLayoutId = ({
  skip = false,
}: { skip?: boolean } = {}) => {
  const { data } = useQuery<FindStandalonePageLayoutUniversalIdentifiersResult>(
    FIND_STANDALONE_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS,
    { skip },
  );

  return {
    myDayPageLayoutId: data?.getPageLayouts.find(
      (pageLayout) =>
        pageLayout.universalIdentifier ===
        MY_DAY_COUNT_SOURCE.pageLayoutUniversalIdentifier,
    )?.id,
  };
};
