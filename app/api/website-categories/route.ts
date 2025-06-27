/**
 * Website Categories API Routes
 * GET /api/website-categories - Get all website categories
 * POST /api/website-categories - Create new category
 */

import { NextResponse } from 'next/server';

// In-memory storage for categories (you could also use a simple config table)
// This simulates dynamic category management without changing your existing schema
const websiteCategories = [
  { id: 1, name: 'music', description: 'Music-related websites and platforms', color: '#e11d48', is_active: true },
  { id: 2, name: 'photo', description: 'Photography and image-related services', color: '#0ea5e9', is_active: true },
  { id: 3, name: 'text-to-speech', description: 'TTS and voice generation platforms', color: '#8b5cf6', is_active: true },
  { id: 4, name: 'image-editing', description: 'Image editing and manipulation tools', color: '#f59e0b', is_active: true },
  { id: 5, name: 'productivity', description: 'Productivity and workflow tools', color: '#10b981', is_active: true },
  { id: 6, name: 'saas', description: 'Software as a Service platforms', color: '#3b82f6', is_active: true },
  { id: 7, name: 'other', description: 'Other miscellaneous categories', color: '#6b7280', is_active: true }
];

let nextId = 8;

export async function GET() {
  try {
    const activeCategories = websiteCategories.filter(cat => cat.is_active);
    
    return NextResponse.json({
      data: activeCategories,
      success: true
    });
  } catch (error) {
    console.error('Error fetching website categories:', error);
    
    return NextResponse.json(
      {
        data: [],
        success: false,
        message: 'Failed to fetch website categories'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, color } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: 'Category name is required'
        },
        { status: 400 }
      );
    }

    // Check if category already exists
    const existingCategory = websiteCategories.find(cat => 
      cat.name.toLowerCase() === name.toLowerCase() && cat.is_active
    );
    
    if (existingCategory) {
      return NextResponse.json(
        {
          success: false,
          message: 'A category with this name already exists'
        },
        { status: 409 }
      );
    }

    // Create new category
    const newCategory = {
      id: nextId++,
      name: name.toLowerCase().replace(/\s+/g, '-'),
      description: description || '',
      color: color || '#6b7280',
      is_active: true
    };

    websiteCategories.push(newCategory);

    return NextResponse.json({
      data: newCategory,
      success: true,
      message: 'Website category created successfully'
    });
  } catch (error) {
    console.error('Error creating website category:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to create website category'
      },
      { status: 500 }
    );
  }
} 