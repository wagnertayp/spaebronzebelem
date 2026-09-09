import { useEffect, useState } from 'react';
import { QuoteList, QuoteForm } from '@/components/quotes';
import { useSearch } from 'wouter';

export function Servicos() {
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  const [quoteId, setQuoteId] = useState<number | undefined>(undefined);
  const searchString = useSearch();

  useEffect(() => {
    const search = new URLSearchParams(searchString);
    const action = search.get('action');
    const id = search.get('id');

    if (action === 'create') {
      setView('create');
      setQuoteId(undefined);
    } else if (action === 'edit' && id) {
      setView('edit');
      setQuoteId(parseInt(id, 10));
    } else {
      setView('list');
      setQuoteId(undefined);
    }
  }, [searchString]);

  if (view === 'create') {
    return <QuoteForm />;
  }

  if (view === 'edit') {
    return <QuoteForm quoteId={quoteId} />;
  }

  return <QuoteList />;
}