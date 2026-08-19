# Backlink Tracker

A comprehensive backlink management system to track and manage backlinks across multiple websites. Built for SEO professionals who need to efficiently manage backlink opportunities across their website portfolio.

## Backlink Desk extension API

The Chrome extension uses `GET/PATCH /api/extension/workspace` to read and update
the existing PostgreSQL websites, resources, backlinks, and website information.
Discovery prospects are stored in the separate `extension_prospects` table; the
`partner_links` table is never read or modified by this endpoint.

Set a long random `BACKLINK_EXTENSION_TOKEN` in the deployment environment. The
extension sends it as a Bearer token. The prospects table is created on the first
authenticated request, or it can be created ahead of time with:

```bash
psql "$DATABASE_URL" -f migrations/add-extension-prospects.sql
```

## 🚀 Features

- **Multi-Website Management**: Manage backlinks for 10+ websites from a single dashboard
- **Auto-Linking System**: Automatically assign new resources to all websites and vice versa
- **Progress Tracking**: Monitor backlink placement status and completion rates
- **Inline Editing**: Quick edit anchor texts, URLs, and status updates
- **Bulk Operations**: Mass update status, export data, and bulk actions
- **Resource Management**: Track domain authority, costs, and placement dates

## 🛠️ Tech Stack

- **Frontend**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **Database**: Cloudflare D1 (SQLite)
- **Hosting**: Cloudflare Pages
- **ORM**: Drizzle ORM (D1 optimized)
- **Authentication**: NextAuth.js (planned)

## 📋 Project Structure

```
backlink-tracker/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── websites/      # Website CRUD operations
│   │   ├── resources/     # Resource CRUD operations
│   │   └── backlinks/     # Backlink management
│   ├── components/        # Reusable UI components
│   │   ├── ui/           # shadcn/ui components
│   │   ├── website-selector.tsx
│   │   ├── resource-table.tsx
│   │   └── backlink-dashboard.tsx
│   ├── lib/              # Utility functions
│   └── page.tsx          # Main dashboard
├── database/             # Database setup
│   ├── schema.sql        # Database tables and triggers
│   └── seed.sql          # Sample data
├── types/               # TypeScript type definitions
└── public/              # Static assets
```

## 🏗️ Database Schema

### Core Tables
- `websites` - Your website portfolio
- `resources` - Backlink opportunities/resources
- `backlinks` - Junction table tracking all relationships

### Auto-Linking Features
- New resources automatically assigned to all active websites
- New websites automatically get all active resources
- Maintains many-to-many relationships seamlessly

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- MySQL 8.0+
- npm/yarn/pnpm

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backlink-tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Setup environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Configure your database connection and other settings.

4. **Database setup**
   ```bash
   # Install Wrangler CLI for D1 management
   npm install -g wrangler
   
   # Create D1 database
   wrangler d1 create backlink-tracker
   
   # Apply schema
   wrangler d1 execute backlink-tracker --file=database/schema.sql
   
   # Optional: Add sample data
   wrangler d1 execute backlink-tracker --file=database/seed.sql
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open [http://localhost:3000](http://localhost:3000)**

## 📊 Development Workflow

### ✅ Completed Phases
- **Phase 1**: Core Setup (Database schema, TypeScript foundation)
- **Phase 2**: UI Foundation (shadcn/ui, Tailwind, component architecture)  
- **Phase 3**: Core Components (website cards, resource table, status badges)
- **Phase 4**: Dashboard Pages (complete 2-page workflow with mock data)

### 🎯 Next Steps

### Phase 5: API Integration
- [ ] Environment configuration (Cloudflare D1 setup)
- [ ] Database connection and migration
- [ ] API routes for websites CRUD
- [ ] API routes for backlinks CRUD
- [ ] Replace mock data with real database calls

### Phase 6: Complete CRUD Operations
- [ ] Add new website form and functionality
- [ ] Add new resource form and functionality
- [ ] Delete operations (websites, resources)
- [ ] Bulk update API integration (connect existing UI)

### Phase 7: Advanced Features
- [ ] Export data functionality (CSV/Excel)
- [ ] User authentication (NextAuth.js)
- [ ] Progress analytics and charts
- [ ] Email notifications for status changes

### Phase 8: Production Ready
- [ ] Error handling and validation
- [ ] Performance optimization and caching
- [ ] Deployment to Cloudflare Pages
- [ ] Production database setup

## 🎨 UI Implementation Guide

### Step-by-Step UI Development

#### **1. Setup shadcn/ui Foundation**
```bash
# Install shadcn/ui CLI
npx shadcn@latest init

# Install required components
npx shadcn@latest add button card table badge input select
npx shadcn@latest add sheet dialog dropdown-menu progress
```

#### **2. Create TypeScript Interfaces**
```typescript
// types/index.ts
interface Website {
  id: number;
  domain: string;
  name: string;
  category: string;
  totalOpportunities: number;
  liveBacklinks: number;
  completionRate: number;
}

interface Resource {
  id: number;
  domain: string;
  url: string;
  domainAuthority: number;
  category: string;
  cost: number;
}

interface Backlink {
  id: number;
  websiteId: number;
  resourceId: number;
  status: 'pending' | 'requested' | 'placed' | 'live' | 'removed' | 'rejected';
  anchorText?: string;
  targetUrl?: string;
  placementDate?: string;
}
```

#### **3. Main UI Workflow**

**Page 1: Website Selector Dashboard**
- Grid layout with website cards
- Progress indicators (completion percentages)
- Search and filter functionality
- Click to select website

**Page 2: Resource Management Dashboard**
- Selected website header with back navigation
- Data table with all backlink opportunities
- Inline editing for anchor text and target URLs
- Status dropdown updates
- Bulk operation tools

#### **4. Key UI Components**

```
components/
├── ui/                     # shadcn/ui base components
├── website-card.tsx        # Website overview card
├── website-grid.tsx        # Grid of website cards
├── resource-table.tsx      # Main backlinks table
├── status-badge.tsx        # Status indicator badges
├── progress-bar.tsx        # Completion progress
├── bulk-actions.tsx        # Mass update tools
└── navigation.tsx          # Breadcrumbs and back button
```

#### **5. Responsive Design Approach**
- **Desktop**: Two-column layouts, full data tables
- **Tablet**: Single column, collapsible sections
- **Mobile**: Card-based layouts, swipe actions

### 🎯 Key UI Features

#### **Website Selector Dashboard**
- **Grid Layout**: 3-4 website cards per row
- **Progress Indicators**: Circular progress with percentages
- **Quick Stats**: Total opportunities, live links, pending
- **Search Bar**: Filter websites by domain or category
- **Responsive Cards**: Adapt to screen size

#### **Resource Management Dashboard**
- **Header Section**: Selected website info + progress overview
- **Data Table**: Sortable columns, inline editing
- **Status Management**: Dropdown selectors, color-coded badges
- **Bulk Operations**: Select multiple, mass status updates
- **Filtering**: By status, domain authority, category

#### **Interactive Elements**
- **Inline Editing**: Click-to-edit anchor text and URLs
- **Status Updates**: Dropdown selections with auto-save
- **Bulk Selection**: Checkbox selection with action toolbar
- **Real-time Updates**: Optimistic UI updates

### 🎨 Design System

#### **Color Scheme**
- **Primary**: Blue (#3B82F6) for main actions
- **Success**: Green (#10B981) for live backlinks
- **Warning**: Yellow (#F59E0B) for pending/requested
- **Danger**: Red (#EF4444) for rejected
- **Neutral**: Gray (#6B7280) for secondary text

#### **Status Color Coding**
- 🟢 **Live**: Green background, white text
- 🟡 **Requested**: Yellow background, dark text  
- 🔵 **Placed**: Blue background, white text
- ⚪ **Pending**: Gray background, dark text
- 🔴 **Rejected**: Red background, white text

#### **Typography**
- **Headers**: Font weight 600-700, larger sizes
- **Body**: Font weight 400, readable line height
- **Captions**: Font weight 500, smaller sizes, muted colors

## 🔧 API Endpoints

```
GET    /api/websites              # List all websites
POST   /api/websites              # Create new website
PUT    /api/websites/:id          # Update website
DELETE /api/websites/:id          # Delete website

GET    /api/resources             # List all resources
POST   /api/resources             # Create new resource
PUT    /api/resources/:id         # Update resource
DELETE /api/resources/:id         # Delete resource

GET    /api/backlinks/:websiteId  # Get backlinks for website
PUT    /api/backlinks/:id         # Update backlink status
POST   /api/backlinks/bulk        # Bulk update operations
```

---

**Built for efficient backlink management across multiple website portfolios.**
