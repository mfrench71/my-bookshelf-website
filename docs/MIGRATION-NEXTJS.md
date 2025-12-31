# Migration Plan: 11ty to Next.js

This document outlines the migration strategy from the current 11ty static site to a Next.js full-stack application, enabling multi-user features.

---

## Why Migrate?

### Current Limitations (11ty)
- **No server-side rendering** - All dynamic content rendered client-side
- **No API routes** - Complex logic requires Firebase Functions
- **Client-only security** - Firestore rules become unmanageable for multi-user
- **No SSR for SEO** - Shared/public content won't be indexed well
- **Scaling concerns** - Cross-user queries expensive from client

### Target Features Requiring Server-Side
- Role-based permissions (admin, user, guest, viewer)
- Sharing books, lists, profiles between users
- Public profiles with SEO
- Activity feeds aggregating across users
- Email notifications and invites
- Friend/follow system
- Book clubs/groups

---

## Technology Decisions

### Framework: Next.js 14+ (App Router)
- Server Components for data fetching
- API Routes for backend logic
- Server Actions for mutations
- Middleware for auth/permissions
- Largest ecosystem and community

### Database Options

| Option | Pros | Cons |
|--------|------|------|
| **Keep Firestore** | No data migration, familiar | Limited query flexibility, costs scale with reads |
| **Migrate to Postgres** | Better for relational data (users, permissions), cheaper at scale | Data migration required, more setup |
| **Hybrid** | Firestore for real-time (activity), Postgres for relational | Complexity |

**Recommendation:** Start with Firestore, plan Postgres migration later if needed.

### Authentication
- Keep Firebase Auth initially
- Consider NextAuth.js later for more providers/flexibility

### Hosting (Free Tier Comparison)

| Provider | Free Tier | Next.js Support | Limitations |
|----------|-----------|-----------------|-------------|
| **Vercel** | Hobby (free) | Native, best | 100GB bandwidth, 6000 min build/month |
| **Netlify** | Free tier | Good (adapter) | 100GB bandwidth, 300 min build/month |
| **Cloudflare Pages** | Free | Good (adapter) | Unlimited bandwidth, 500 builds/month |
| **Railway** | $5 credit/month | Full | Credit-based, may need payment method |
| **Render** | Free static | Limited SSR | Static only on free tier |

**Recommendation: Vercel or Netlify**

- **Vercel** - Best Next.js experience, generous free tier, keeps GitHub workflow
- **Netlify** - Already in use, supports Next.js via `@netlify/plugin-nextjs`, familiar

Both integrate with GitHub for automatic deployments. Netlify may be easier since you're already using it.

**Netlify Next.js Setup:**
```bash
npm install @netlify/plugin-nextjs
```
```toml
# netlify.toml
[[plugins]]
  package = "@netlify/plugin-nextjs"
```

---

## Cost Considerations

**Goal: Keep the project completely free**

### Current Costs (Free)
- **GitHub** - Free for public/private repos
- **Netlify** - Free tier (current hosting)
- **Firebase** - Spark plan (free tier)
  - 1GB Firestore storage
  - 50K reads/day, 20K writes/day
  - 1GB Auth storage

### Post-Migration Costs (Still Free)

| Service | Plan | Cost |
|---------|------|------|
| GitHub | Free | $0 |
| Netlify or Vercel | Free tier | $0 |
| Firebase Auth | Spark | $0 |
| Firestore | Spark | $0 |
| Firebase Storage | Spark (5GB) | $0 |

### Scaling Considerations

If user base grows significantly:
- **Firestore** - Monitor daily read/write limits; Blaze plan is pay-as-you-go
- **Hosting** - Free tiers generous for hobby projects; upgrade if needed
- **Images** - Consider Cloudinary free tier (25GB) if Storage fills up

### Cost Monitoring
- Firebase Console → Usage tab
- Netlify/Vercel dashboard → Bandwidth usage
- Set up Firebase budget alerts (even on free tier)

---

## Migration Phases

### Phase 1: Project Setup (Week 1)
- [ ] Create new Next.js project with TypeScript
- [ ] Configure Tailwind CSS v4 (same config)
- [ ] Set up Firebase SDK (client + admin)
- [ ] Port design tokens and base styles
- [ ] Set up environment variables
- [ ] Configure ESLint, Prettier (match current config)

### Phase 2: Core Infrastructure (Week 1-2)
- [ ] Implement authentication middleware
- [ ] Create auth context/hooks
- [ ] Port Firebase config and initialisation
- [ ] Set up protected route patterns
- [ ] Create API route structure
- [ ] Port repository pattern to work with server components

### Phase 3: Port Pages - Auth & Layout (Week 2)
- [ ] Base layout (header, footer, navigation)
- [ ] Login/register pages
- [ ] Auth state management
- [ ] Redirect logic

### Phase 4: Port Pages - Core Features (Week 2-3)
- [ ] Home dashboard with widgets
- [ ] Books list page (with filters, sorting)
- [ ] Book view page
- [ ] Book add page (ISBN lookup, barcode scanner)
- [ ] Book edit page

### Phase 5: Port Pages - Settings (Week 3)
- [ ] Profile settings
- [ ] Library settings (genres, series, backup)
- [ ] Preferences (widgets, sync)
- [ ] Maintenance tools
- [ ] Bin management

### Phase 6: Port Components (Ongoing)
- [ ] AuthorPicker
- [ ] GenrePicker
- [ ] SeriesPicker
- [ ] CoverPicker
- [ ] RatingInput
- [ ] BookCard
- [ ] FilterPanel
- [ ] Modal/BottomSheet
- [ ] Toast system
- [ ] ImageGallery

### Phase 7: Port Utilities & Services (Ongoing)
- [ ] Validation schemas (Zod - no changes needed)
- [ ] API utilities (book lookup, cover fetch)
- [ ] Cache management
- [ ] Event bus (may need rethinking for server components)

### Phase 8: Testing (Week 3-4)
- [ ] Set up Vitest for unit tests
- [ ] Port existing tests
- [ ] Set up Playwright for E2E
- [ ] Port E2E tests
- [ ] Add API route tests

### Phase 9: PWA & Offline (Week 4)
- [ ] Configure next-pwa or similar
- [ ] Port service worker logic
- [ ] Offline fallback pages
- [ ] App manifest

### Phase 10: Deployment & Cutover
- [ ] Deploy to Vercel (staging)
- [ ] Test all functionality
- [ ] DNS cutover
- [ ] Monitor for issues

---

## Architecture Changes

### Current (11ty)
```
Browser → Static HTML → Client JS → Firebase (direct)
```

### Target (Next.js)
```
Browser → Next.js Server → API Routes → Firebase
                        ↓
              Server Components → Firebase (admin SDK)
```

### Directory Structure (Next.js)
```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── layout.tsx
├── (app)/
│   ├── page.tsx                 # Home dashboard
│   ├── books/
│   │   ├── page.tsx             # Book list
│   │   ├── add/page.tsx
│   │   ├── [id]/page.tsx        # Book view
│   │   └── [id]/edit/page.tsx
│   ├── settings/
│   │   ├── page.tsx             # Profile
│   │   ├── library/page.tsx
│   │   ├── preferences/page.tsx
│   │   ├── maintenance/page.tsx
│   │   └── bin/page.tsx
│   └── layout.tsx               # App shell with header
├── api/
│   ├── books/route.ts
│   ├── genres/route.ts
│   ├── series/route.ts
│   ├── lookup/route.ts          # ISBN/title lookup
│   └── auth/[...nextauth]/route.ts
├── layout.tsx                   # Root layout
└── globals.css

components/
├── ui/                          # Generic UI (Button, Modal, Toast)
├── books/                       # Book-specific (BookCard, CoverPicker)
├── pickers/                     # Form pickers (Genre, Series, Author)
└── widgets/                     # Dashboard widgets

lib/
├── firebase/
│   ├── client.ts                # Client SDK init
│   ├── admin.ts                 # Admin SDK init
│   └── auth.ts                  # Auth helpers
├── repositories/                # Data access layer
├── schemas/                     # Zod schemas
├── utils/                       # Utilities
└── hooks/                       # React hooks
```

---

## Key Implementation Patterns

### Server Components for Data Fetching
```tsx
// app/(app)/books/page.tsx
import { getBooks } from '@/lib/repositories/books';
import { getCurrentUser } from '@/lib/firebase/auth';

export default async function BooksPage() {
  const user = await getCurrentUser();
  const books = await getBooks(user.uid);

  return <BookList books={books} />;
}
```

### API Routes for Mutations
```tsx
// app/api/books/route.ts
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { BookSchema } from '@/lib/schemas/book';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const result = BookSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ errors: result.error.flatten() }, { status: 400 });
  }

  const book = await adminDb
    .collection('users').doc(user.uid)
    .collection('books').add(result.data);

  return NextResponse.json({ id: book.id });
}
```

### Middleware for Auth
```tsx
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('session');

  if (!token && request.nextUrl.pathname.startsWith('/books')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/books/:path*', '/settings/:path*'],
};
```

---

## Multi-User Features (Post-Migration)

Once migrated, these features become feasible:

### Phase A: Sharing Foundation
- [ ] Public/private toggle for profiles
- [ ] Shareable book list links (read-only)
- [ ] User search/discovery

### Phase B: Social Features
- [ ] Follow/friend system
- [ ] Activity feed (what friends are reading)
- [ ] Book recommendations from friends

### Phase C: Collaboration
- [ ] Shared lists (e.g., "Books to discuss")
- [ ] Book clubs with members
- [ ] Group reading challenges

### Phase D: Permissions
- [ ] Role system (owner, editor, viewer)
- [ ] Invite links with expiry
- [ ] Privacy controls per-item

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Data loss during migration | No data migration needed - same Firestore |
| Feature regression | Comprehensive E2E tests before/after |
| Downtime during cutover | Blue-green deployment, quick DNS rollback |
| Performance regression | Lighthouse audits, Core Web Vitals monitoring |
| PWA functionality loss | Test offline mode thoroughly |

---

## Rollback Plan

1. Keep 11ty site deployed at `old.mybookshelf.app`
2. DNS can switch back within minutes
3. No database changes, so data is compatible
4. Maintain 11ty repo for 30 days post-migration

---

## Success Criteria

- [ ] All existing functionality works
- [ ] Lighthouse scores maintained (90+ performance)
- [ ] All tests passing
- [ ] PWA installable and works offline
- [ ] No increase in page load times
- [ ] Ready for multi-user feature development

---

## Estimated Timeline

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Setup & Infrastructure | 1 week | Week 1 |
| Port Auth & Layout | 0.5 week | Week 1.5 |
| Port Core Pages | 1 week | Week 2.5 |
| Port Settings & Components | 1 week | Week 3.5 |
| Testing & PWA | 0.5 week | Week 4 |
| **Total** | **4 weeks** | |

*Timeline assumes focused effort. Can be parallelised or extended based on availability.*

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-12-31 | Migrate to Next.js | Multi-user features require server-side capabilities |
| | Keep Firestore initially | Avoid data migration complexity |
| | Use Vercel for hosting | Best Next.js support, simple deployment |

---

## References

- [Next.js App Router Documentation](https://nextjs.org/docs/app)
- [Firebase Admin SDK with Next.js](https://firebase.google.com/docs/admin/setup)
- [NextAuth.js](https://next-auth.js.org/) (future consideration)
- [next-pwa](https://github.com/shadowwalker/next-pwa)

---

*Created: 2025-12-31*
