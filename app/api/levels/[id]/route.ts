import { NextRequest, NextResponse } from 'next/server';
import { getLevelByIdentifier, updateLevel, deleteLevel } from '@/app/api/_lib/services/levelService';
import debug from 'debug';

const logger = debug('ui_designer:api:levels');

const respondWithError = (error: any, status: number = 400) => {
  logger('%O', error);
  return NextResponse.json({ error: error.message }, { status });
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || typeof id !== 'string') {
      return respondWithError(new Error('Invalid ID'));
    }

    const level = await getLevelByIdentifier(id);
    return level
      ? NextResponse.json({
          identifier: level.identifier,
          name: level.name,
          ...level.json,
        })
      : NextResponse.json({ message: 'Level not found' }, { status: 404 });
  } catch (error: any) {
    logger('Error %O', error);
    return NextResponse.json(
      { message: 'Failed to fetch level' },
      { status: 500 }
    );
  }
}

// UUID validation regex: matches standard UUID format (8-4-4-4-12 hexadecimal digits)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isValidUUID = (str: string): boolean => {
  return UUID_REGEX.test(str);
};

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || typeof id !== 'string') {
      return respondWithError(new Error('Invalid ID'));
    }

    // Validate that the ID is a valid UUID format
    if (!isValidUUID(id)) {
      logger('Invalid UUID format: %s', id);
      return NextResponse.json(
        { 
          message: 'Invalid identifier format: expected UUID',
          error: `The identifier "${id}" is not a valid UUID format. Use POST to create a new level instead.`
        },
        { status: 400 }
      );
    }

    const existingLevel = await getLevelByIdentifier(id);
    if (!existingLevel) {
      return NextResponse.json(
        { message: 'Failed to update: level not found' },
        { status: 404 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (parseError: any) {
      logger('Failed to parse request body: %O', parseError);
      return NextResponse.json(
        { message: 'Invalid JSON in request body', error: parseError.message },
        { status: 400 }
      );
    }

    const { name, ...json } = body;

    // Validate that json is an object (not null, undefined, or primitive)
    if (json !== undefined && json !== null && typeof json !== 'object') {
      logger('Invalid json type: %O', typeof json);
      return NextResponse.json(
        { message: 'Invalid json data: must be an object' },
        { status: 400 }
      );
    }

    // Ensure existingLevel.json is an object before merging
    const existingJson = existingLevel.json && typeof existingLevel.json === 'object' 
      ? existingLevel.json 
      : {};

    // Prepare the merged json object
    const mergedJson = json && Object.keys(json).length > 0
      ? { ...existingJson, ...json }
      : existingJson;

    logger('Updating level %s with name: %s, json keys: %s', 
      id, 
      name || existingLevel.name,
      Object.keys(mergedJson).join(', ')
    );

    let updatedLevel;
    try {
      updatedLevel = await updateLevel(id, {
        name: name || existingLevel.name,
        json: mergedJson,
      });
    } catch (updateError: any) {
      // Log to both debug logger and console for visibility
      logger('Error in updateLevel: %O', updateError);
      logger('Error stack: %s', updateError.stack);
      logger('Request body: %O', body);
      logger('Merged json: %O', mergedJson);
      
      console.error('[PUT /api/levels/[id]] Error updating level:', {
        identifier: id,
        error: updateError,
        message: updateError?.message,
        stack: updateError?.stack,
        requestBody: body,
        mergedJson: mergedJson
      });
      
      const errorMessage = updateError?.message || 'Unknown error occurred';
      return NextResponse.json(
        { 
          message: 'Failed to update level',
          error: errorMessage,
          ...(process.env.NODE_ENV === 'development' && { 
            details: updateError?.stack,
            requestBody: body,
            mergedJson: mergedJson
          })
        },
        { status: 500 }
      );
    }

    if (!updatedLevel) {
      logger('updateLevel returned null for identifier: %s', id);
      return NextResponse.json(
        { message: 'Failed to update level: update returned no result' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      identifier: updatedLevel.identifier,
      name: updatedLevel.name,
      ...updatedLevel.json,
    });
  } catch (error: any) {
    // Log to both debug logger and console for visibility
    logger('Unexpected error in PUT handler: %O', error);
    logger('Error stack: %s', error.stack);
    
    console.error('[PUT /api/levels/[id]] Unexpected error:', {
      error,
      message: error?.message,
      stack: error?.stack
    });
    
    const errorMessage = error?.message || 'Unknown error occurred';
    return NextResponse.json(
      { 
        message: 'Failed to update level',
        error: errorMessage,
        ...(process.env.NODE_ENV === 'development' && { 
          details: error?.stack
        })
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || typeof id !== 'string') {
      return respondWithError(new Error('Invalid ID'));
    }

    const level = await getLevelByIdentifier(id);
    if (!level) {
      return NextResponse.json({ message: 'Level not found' }, { status: 404 });
    }

    const deleted = await deleteLevel(id);
    return deleted
      ? new NextResponse(null, { status: 204 })
      : NextResponse.json({ message: 'Failed to delete level' }, { status: 500 });
  } catch (error: any) {
    logger('Error %O', error);
    return NextResponse.json(
      { message: 'Failed to delete level' },
      { status: 500 }
    );
  }
}

