/**
 * Website Category by ID API Routes
 * PUT /api/website-categories/[id] - Update category
 * DELETE /api/website-categories/[id] - Delete category
 */

import { NextResponse } from 'next/server';

// Note: In a real application, you'd want to use a database or persistent storage
// This is a simple in-memory approach that works with your current schema
const websiteCategories = [
  { id: 1, name: 'music', description: 'Music-related websites and platforms', color: '#e11d48', is_active: true },
  { id: 2, name: 'photo', description: 'Photography and image-related services', color: '#0ea5e9', is_active: true },
  { id: 3, name: 'text-to-speech', description: 'TTS and voice generation platforms', color: '#8b5cf6', is_active: true },
  { id: 4, name: 'image-editing', description: 'Image editing and manipulation tools', color: '#f59e0b', is_active: true },
  { id: 5, name: 'productivity', description: 'Productivity and workflow tools', color: '#10b981', is_active: true },
  { id: 6, name: 'saas', description: 'Software as a Service platforms', color: '#3b82f6', is_active: true },
  { id: 7, name: 'other', description: 'Other miscellaneous categories', color: '#6b7280', is_active: true }
];

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const categoryId = parseInt(id);
    
    if (isNaN(categoryId)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid category ID'
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, description, color } = body;

    const categoryIndex = websiteCategories.findIndex(cat => cat.id === categoryId && cat.is_active);
    
    if (categoryIndex === -1) {
      return NextResponse.json(
        {
          success: false,
          message: 'Category not found'
        },
        { status: 404 }
      );
    }

    // Check if new name conflicts with existing categories (excluding current one)
    if (name) {
      const existingCategory = websiteCategories.find(cat => 
        cat.id !== categoryId && 
        cat.name.toLowerCase() === name.toLowerCase() && 
        cat.is_active
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
    }

    // Update category
    const updatedCategory = {
      ...websiteCategories[categoryIndex],
      ...(name && { name: name.toLowerCase().replace(/\s+/g, '-') }),
      ...(description !== undefined && { description }),
      ...(color && { color })
    };

    websiteCategories[categoryIndex] = updatedCategory;

    return NextResponse.json({
      data: updatedCategory,
      success: true,
      message: 'Website category updated successfully'
    });
  } catch (error) {
    console.error('Error updating website category:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to update website category'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const categoryId = parseInt(id);
    
    if (isNaN(categoryId)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid category ID'
        },
        { status: 400 }
      );
    }

    const categoryIndex = websiteCategories.findIndex(cat => cat.id === categoryId && cat.is_active);
    
    if (categoryIndex === -1) {
      return NextResponse.json(
        {
          success: false,
          message: 'Category not found'
        },
        { status: 404 }
      );
    }

    // Soft delete - set is_active to false
    websiteCategories[categoryIndex].is_active = false;

    return NextResponse.json({
      success: true,
      message: 'Website category deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting website category:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to delete website category'
      },
      { status: 500 }
    );
  }
} 