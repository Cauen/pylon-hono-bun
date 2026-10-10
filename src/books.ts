type Genre = 'FANTASY' | 'SCIENCE_FICTION' | 'ROMANCE' | 'TECHNOLOGY'

interface Author {
  name: string
  country: string
}

interface Book {
  id: string
  title: string
  genres: Genre[]
  publishedYear: number
  author: Author
}

interface PublishedYearRange {
  from?: number
  to?: number
}

interface Pagination {
  limit: number
  offset: number
}

export interface BookSearch {
  title?: string
  genres?: Genre[]
  publishedYearRange?: PublishedYearRange
  pagination?: Pagination
}

interface BookSearchResult {
  items: Book[]
  total: number
  hasNextPage: boolean
}

const DEFAULT_PAGINATION: Pagination = {limit: 10, offset: 0}

const BOOKS: Book[] = [
  {
    id: '1',
    title: 'The Hobbit',
    genres: ['FANTASY'],
    publishedYear: 1937,
    author: {name: 'J. R. R. Tolkien', country: 'United Kingdom'}
  },
  {
    id: '2',
    title: 'Dune',
    genres: ['SCIENCE_FICTION'],
    publishedYear: 1965,
    author: {name: 'Frank Herbert', country: 'United States'}
  },
  {
    id: '3',
    title: 'Pride and Prejudice',
    genres: ['ROMANCE'],
    publishedYear: 1813,
    author: {name: 'Jane Austen', country: 'United Kingdom'}
  },
  {
    id: '4',
    title: 'Clean Code',
    genres: ['TECHNOLOGY'],
    publishedYear: 2008,
    author: {name: 'Robert C. Martin', country: 'United States'}
  },
  {
    id: '5',
    title: 'The Left Hand of Darkness',
    genres: ['SCIENCE_FICTION', 'FANTASY'],
    publishedYear: 1969,
    author: {name: 'Ursula K. Le Guin', country: 'United States'}
  }
]

const matchesTitle = (book: Book, title?: string): boolean => {
  const normalizedSearch = title?.trim().toLowerCase() ?? ''
  return book.title.toLowerCase().includes(normalizedSearch)
}

const matchesGenres = (book: Book, genres?: Genre[]): boolean => {
  const hasGenreFilter = (genres?.length ?? 0) > 0
  return !hasGenreFilter || book.genres.some(genre => genres?.includes(genre))
}

const matchesPublishedYearRange = (
  book: Book,
  range?: PublishedYearRange
): boolean => {
  const isAfterStart = book.publishedYear >= (range?.from ?? -Infinity)
  const isBeforeEnd = book.publishedYear <= (range?.to ?? Infinity)
  return isAfterStart && isBeforeEnd
}

export const searchBooks = (input: BookSearch): BookSearchResult => {
  const {limit, offset} = input.pagination ?? DEFAULT_PAGINATION

  const matchingBooks = BOOKS.filter(
    book =>
      matchesTitle(book, input.title) &&
      matchesGenres(book, input.genres) &&
      matchesPublishedYearRange(book, input.publishedYearRange)
  )

  const pageEnd = offset + limit
  const pageItems = matchingBooks.slice(offset, pageEnd)
  const hasNextPage = pageEnd < matchingBooks.length

  return {items: pageItems, total: matchingBooks.length, hasNextPage}
}
