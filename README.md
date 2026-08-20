# MyWork

A personal work management application for tracking dailies, priorities, and yearly goals.

## Features

- **Dailies**: Track daily work items with calendar navigation
- **My Priorities**: Manage priorities with drag-and-drop reordering
- **Yearly Goals**: Set and track yearly goals with categories and status
- **Settings**: Configure data sources (Outlook, Azure DevOps, GitHub, etc.)

## Tech Stack

- **Backend**: Node.js 20+, Express.js
- **Database**: MySQL 8.0+ or MariaDB (any server speaking the MySQL wire protocol)
- **Frontend**: EJS templating, Bootstrap 5
- **Security**: express-session, CSRF protection, rate limiting
- **Logging**: Winston

## Installation

### Prerequisites

- Node.js 20+
- MySQL 8.0+ or MariaDB

### Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` file (copy from `.env.example`):
```bash
cp .env.example .env.local
```

3. Update database credentials in `.env.local` if needed

4. Initialize database:
```bash
mysql -u root < scripts/init-db.sql
```

5. Start development server:
```bash
npm run dev
```

The app will be available at http://localhost:3000

## Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with hot reload
- `npm test` - Run tests
- `npm run lint` - Lint code

## Database Schema

### Tables
- `sources` - Data source configurations
- `goals` - Yearly goals
- `goal_categories` - Goal categorization
- `priorities` - User priorities
- `work_items` - Daily work entries
- `work_goal_associations` - Work-to-goal relationships
- `work_priority_associations` - Work-to-priority relationships
- `work_source_associations` - Work-to-source relationships

## Project Structure

```
src/
├── config/          - Configuration files
├── database/        - Database connection and queries
├── middleware/      - Express middleware
├── routes/          - Route handlers
├── services/        - Business logic
├── views/           - EJS templates
│   ├── layouts/     - Layout templates
│   ├── pages/       - Page templates
│   ├── tabs/        - Tab content templates
│   ├── components/  - Reusable components
│   └── partials/    - Partial templates
└── public/          - Static files (CSS, JS, images)
```

## Development

### Tab-Based Architecture

The application uses a client-side tab system:
- All tab content is loaded upfront into the DOM
- Tab switching is handled via client-side JavaScript
- Tab state is reflected in the URL query parameter (`?tab=dailies`)
- URLs are shareable and support browser history

### Form Handling

- CSRF protection on all state-changing requests
- Client-side form validation
- Toast notifications for user feedback
- Automatic CSRF token injection

### API Endpoints

API endpoints follow RESTful conventions:
- `GET /api/tab/:name` - Get tab content/data
- `GET /api/:resource` - List resources
- `POST /api/:resource` - Create resource
- `PUT /api/:resource/:id` - Update resource
- `DELETE /api/:resource/:id` - Delete resource

## License

MIT
