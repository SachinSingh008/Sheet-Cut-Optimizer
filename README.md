# SteelFlow AI

You are an award-winning Senior Product Designer and Frontend Architect.

Design and build a beautiful, modern, enterprise-grade web application UI for an AI-powered Steel Plate Cut Sheet Optimizer.

The application should look like a premium SaaS product even though it will initially be a free tool.

DO NOT build authentication.

DO NOT build signup/login pages.

DO NOT build user profiles.

This application is a temporary workspace.

The user visits the website, uploads an Excel file, optimizes steel plates, downloads reports, and leaves.

Everything should feel clean, modern, premium, and fast.

Think of a combination of:

• Linear.app

• Notion

• Stripe Dashboard

• Figma

• Vercel Dashboard

• Autodesk Fusion

• OnShape

• Material Design 3

The UI should feel professional enough for fabrication companies and engineers.

====================================================

COLOR THEME

Primary:

#2563EB

Accent:

#14B8A6

Success:

#22C55E

Warning:

#F59E0B

Danger:

#EF4444

Background:

#F8FAFC

Dark Mode:

#0F172A

Cards:

Rounded XL

Soft Shadows

Use subtle gradients.

Large spacing.

Glassmorphism only where appropriate.

====================================================

TYPOGRAPHY

Use Inter.

Large headings.

Professional tables.

Excellent spacing.

Minimalistic icons.

Use Lucide Icons.

====================================================

APPLICATION NAME

AI Steel Cut Optimizer

Suggest a modern logo.

Create a premium brand identity.

====================================================

LANDING PAGE

Create a beautiful landing page.

Hero Section

Large title:

"Optimize Steel Plate Cutting in Seconds"

Subtitle:

Upload your BOM or Excel and instantly generate optimized cutting layouts, material reports and scrap analysis.

Buttons:

Upload Excel

Try Demo

Features Section

Cards

AI Material Detection

Thickness Grouping

Smart Nesting

Material Optimization

Excel Reports

PDF Reports

Waste Analysis

Responsive Design

Footer

====================================================

MAIN APPLICATION

Use a dashboard layout.

Left Sidebar

Dashboard

Upload

Optimization

Layouts

Reports

Settings

Help

Main Content

Top Navigation

Breadcrumb

Project Status

Theme Toggle

====================================================

UPLOAD PAGE

Large Drag & Drop Area

Accept:

Excel

CSV

PDF

Image

Show beautiful upload animation.

Show upload progress.

After upload show:

File Name

Size

Rows Detected

Materials Detected

Buttons:

Parse BOM

Reset

====================================================

PARSE RESULTS PAGE

Beautiful AG Grid style table.

Columns

Item

Description

Material

Thickness

Length

Width

Quantity

Weight

Allow:

Search

Filter

Sort

Edit

Delete

Highlight invalid rows.

Show summary cards:

Total Parts

Unique Materials

Plate Types

Estimated Weight

====================================================

THICKNESS GROUP PAGE

Cards for each thickness.

Example

PL 6 THK

152 Parts

PL 8 THK

89 Parts

PL 10 THK

34 Parts

Clicking a card opens all parts.

====================================================

OPTIMIZATION PAGE

Large configuration panel.

Inputs

Stock Sheet Size

2500x1250

3000x1500

6000x1500

Kerf

Trim

Rotation Allowed

Optimization Algorithm

Buttons

Run Optimization

Reset

====================================================

OPTIMIZATION RESULTS

Beautiful KPI cards.

Material Utilization

Scrap %

Sheets Required

Material Cost

Estimated Savings

Use animated counters.

====================================================

CUT LAYOUT PAGE

This is the most important page.

Large interactive nesting visualization.

Show sheet.

Inside sheet draw every part.

Different colors.

Hover shows:

Part Number

Dimensions

Quantity

Area

Rotate button

Zoom

Pan

Highlight selected part.

Show waste area in gray.

Multiple sheet navigation.

Previous

Next

Mini thumbnails.

====================================================

REPORT PAGE

Tabs

Summary

Materials

Scrap

Purchasing

Downloads

Charts

Pie Chart

Material Distribution

Bar Chart

Thickness Distribution

Line Chart

Material Usage

Buttons

Download Excel

Download PDF

Download CSV

====================================================

SETTINGS

Kerf

Units

Theme

Default Sheet Size

Language

About

====================================================

HELP PAGE

FAQ

How to Upload

Supported Formats

Optimization Guide

Contact

====================================================

DESIGN SYSTEM

Use

TailwindCSS

shadcn/ui

Radix UI

Lucide Icons

Framer Motion

React Hook Form

Zod

TanStack Table

Recharts

React Dropzone

Konva.js placeholder component

====================================================

ANIMATIONS

Use Framer Motion.

Smooth page transitions.

Card hover animations.

Loading skeletons.

Upload animation.

Animated progress bars.

====================================================

COMPONENTS

Build reusable components.

Button

Card

Upload Zone

Data Table

Sidebar

Navbar

Stats Card

Sheet Viewer

Layout Card

Chart Card

Modal

Drawer

Toast

====================================================

RESPONSIVE

Desktop First.

Tablet.

Mobile.

Everything should remain usable.

====================================================

UX

Minimal clicks.

Large buttons.

Excellent spacing.

Modern engineering software feel.

Every page should guide the user naturally.

====================================================

MOCK DATA

Use realistic fabrication data.

Example:

PL 6 THK

200 x 557

Qty 12

Material IS2062 E250A

Create realistic optimization layouts.

====================================================

CODE QUALITY

Use React + TypeScript.

Use Vite.

Use TailwindCSS.

Use shadcn/ui.

Use reusable components.

Use proper folder structure.

Do not use placeholder lorem ipsum.

Everything should look like a production-ready enterprise application.

Generate every page, route, reusable component, mock data, and responsive layout.

The UI should be polished enough that only backend integration remains.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9efa244d-c5d6-4cc1-bfba-3372da69fc7a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
