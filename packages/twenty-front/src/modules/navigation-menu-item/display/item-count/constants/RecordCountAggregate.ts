import { type RecordGqlFieldsAggregate } from '@/object-record/graphql/types/RecordGqlFieldsAggregate';
import { AggregateOperations } from '@/object-record/record-table/constants/AggregateOperations';

export const RECORD_COUNT_AGGREGATE: RecordGqlFieldsAggregate = {
  id: [AggregateOperations.COUNT],
};
