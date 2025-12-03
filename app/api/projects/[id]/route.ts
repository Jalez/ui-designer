import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getProjectById, updateProject, deleteProject } from '@/app/api/_lib/services/projectService';
import debug from 'debug';

const logger = debug('ui_designer:api:projects');

const respondWithError = (error: any, status: number = 400) =>
  NextResponse.json({ error: error.message }, { status });

/**
 * GET /api/projects/[id]
 * Retrieve a single project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userId = session.userId || session.user.email;
    const { id } = await params;

    if (!id || typeof id !== 'string') {
      return respondWithError(new Error('Invalid project ID'));
    }

    const project = await getProjectById(id, userId);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: project.id,
      userId: project.user_id,
      mapName: project.map_name,
      title: project.title,
      progressData: project.progress_data,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    });
  } catch (error: any) {
    logger('Error %O', error);
    return NextResponse.json(
      { message: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/projects/[id]
 * Update a project
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userId = session.userId || session.user.email;
    const { id } = await params;
    const body = await request.json();

    if (!id || typeof id !== 'string') {
      return respondWithError(new Error('Invalid project ID'));
    }

    // Find project first to verify ownership
    const existingProject = await getProjectById(id, userId);

    if (!existingProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Update project
    const project = await updateProject(id, userId, {
      title: body.title,
      progressData: body.progressData,
    });

    if (!project) {
      return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
    }

    logger('Updated project %s for user %s', id, userId);
    return NextResponse.json({
      id: project.id,
      userId: project.user_id,
      mapName: project.map_name,
      title: project.title,
      progressData: project.progress_data,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    });
  } catch (error: any) {
    logger('Error %O', error);
    return NextResponse.json(
      { message: 'Failed to update project', error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[id]
 * Delete a project
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userId = session.userId || session.user.email;
    const { id } = await params;

    if (!id || typeof id !== 'string') {
      return respondWithError(new Error('Invalid project ID'));
    }

    // Find project first to verify ownership
    const existingProject = await getProjectById(id, userId);

    if (!existingProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Delete project
    const deleted = await deleteProject(id, userId);

    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
    }

    logger('Deleted project %s for user %s', id, userId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger('Error %O', error);
    return NextResponse.json(
      { message: 'Failed to delete project', error: error.message },
      { status: 500 }
    );
  }
}
