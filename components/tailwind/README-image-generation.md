# Image Generation Extension

This extension adds AI-powered image generation capabilities to the editor through slash commands.

## Features

### Slash Commands

1. **Generate Image (Prompt)** - Opens a dialog to enter an image description
2. **Generate Image (Inline)** - Inserts an inline command template for editing
3. **Generate Image** - Alias for the prompt dialog version

### Inline Command

Users can type `/generate_image "description"` and press Enter to generate an image based on the description.

## Architecture

### Components

- **`imageGenerationService.ts`** - Contains exported functions for AI image generation API calls
- **`GenerateImageExtension`** - TipTap extension for command handling
- **`command-utils.ts`** - Reusable utilities for command processing
- **`slash-command.tsx`** - Slash command definitions

### Reusable Logic

The implementation reuses existing patterns from the text generation functionality:

- **Inline command insertion** - Uses `insertInlineCommand` utility
- **Command parsing** - Uses `extractPromptFromCommand` utility  
- **Command removal** - Uses `removeCommandLine` utility
- **Progress feedback** - Shows loading states during generation

## Usage Examples

### Prompt Dialog
1. Type `/` to open slash commands
2. Select "Generate Image (Prompt)"
3. Enter description: "A serene mountain landscape at sunset"
4. Click OK to generate

### Inline Command
1. Type `/` to open slash commands
2. Select "Generate Image (Inline)"
3. Edit the placeholder text: `"A futuristic city with flying cars"`
4. Press Enter to generate

### Direct Command
1. Type: `/generate_image "A cute cartoon cat playing with yarn"`
2. Press Enter to generate

## Configuration

The image generation service currently uses placeholder images for demonstration. To integrate with a real AI service:

1. Update `generateImage()` function in `imageGenerationService.ts` to call your preferred AI image generation API
2. Configure API keys and endpoints
3. Handle different image formats and sizes as needed

## Future Enhancements

- Support for different image sizes (256x256, 512x512, 1024x1024)
- Image quality options (standard, HD)
- Style options (vivid, natural)
- Integration with OpenAI DALL-E, Stable Diffusion, or similar services 