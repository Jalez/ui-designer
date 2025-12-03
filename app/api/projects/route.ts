import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getProjectsByUserId, createProject } from '@/app/api/_lib/services/projectService';
import { getMapByName } from '@/app/api/_lib/services/mapService';
import debug from 'debug';

const logger = debug('ui_designer:api:projects');

const respondWithError = (error: any, status: number = 400) =>
  NextResponse.json({ error: error.message }, { status });

/**
 * GET /api/projects
 * List all projects for authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get userId from session
    const userId = session.userId || session.user.email;

    const projects = await getProjectsByUserId(userId);

    logger('Found %d projects for user %s', projects.length, userId);
    return NextResponse.json(projects.map((p) => ({
      id: p.id,
      userId: p.user_id,
      mapName: p.map_name,
      title: p.title,
      progressData: p.progress_data,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    })));
  } catch (error: any) {
    logger('Error: %O', error);
    return NextResponse.json(
      { message: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects
 * Create a new project
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userId = session.userId || session.user.email;
    const body = await request.json();

    // Validate required fields
    if (!body.mapName || !body.title) {
      return respondWithError(new Error('mapName and title are required'));
    }

    // Verify map exists
    const map = await getMapByName(body.mapName);
    if (!map) {
      return NextResponse.json(
        { error: 'Map not found' },
        { status: 404 }
      );
    }

    // Create project
    const project = await createProject({
      userId,
      mapName: body.mapName,
      title: body.title,
      progressData: body.progressData || {},
    });

    logger('Created project %s for user %s', project.id, userId);
    return NextResponse.json({
      id: project.id,
      userId: project.user_id,
      mapName: project.map_name,
      title: project.title,
      progressData: project.progress_data,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    }, { status: 201 });
  } catch (error: any) {
    logger('Error %O', error);
    return NextResponse.json(
      { message: 'Failed to create project', error: error.message },
      { status: 500 }
    );
  }
}
