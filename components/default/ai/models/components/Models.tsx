"use client";

import { DollarSign, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import type { Column } from "@/components/default/admin/DataTable";
import DataTable from "@/components/default/admin/DataTable";
import type { FieldConfig } from "@/components/default/admin/ItemDialog";
import ItemDialog from "@/components/default/admin/ItemDialog";
import { useNotificationStore } from "@/components/default/notifications";
import { Badge } from "@/components/tailwind/ui/badge";
import { Button } from "@/components/tailwind/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/tailwind/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/tailwind/ui/select";
import { OpenRouterUpdateModal } from "@/components/default/ai/providers/components/OpenRouterUpdateModal";
import { useModelsStore } from "../stores/modelsStore";
import type { Model } from "../types";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";

export default function Models() {
  const models = useModelsStore((state) => state.models);
  const loading = useModelsStore((state) => state.loading);
  const fetchModels = useModelsStore((state) => state.fetchModels);
  const updateModel = useModelsStore((state) => state.updateModel);
  const deleteModel = useModelsStore((state) => state.deleteModel);
  const createModel = useModelsStore((state) => state.createModel);

  const [modalityFilter, setModalityFilter] = useState<string>("all");
  const [editingModel, setEditingModel] = useState<any>(null);
  const [originalModelId, setOriginalModelId] = useState<string | null>(null);
  const [_dialogOpen, setDialogOpen] = useState(false);
  const [openRouterModalOpen, setOpenRouterModalOpen] = useState(false);
  const [validatingModels, setValidatingModels] = useState<Set<string>>(new Set());
  const [validationResults, setValidationResults] = useState<Record<string, { status: 'valid' | 'invalid' | 'error', message?: string }>>({});

  const { showSuccess, showError } = useNotificationStore();

  const validateModel = async (modelId: string): Promise<{ status: 'valid' | 'invalid' | 'error', message?: string }> => {
    try {
      console.log(`MODEL-VALIDATION: Testing model ${modelId}`);

      // Make a minimal test request to validate the model
      const response = await fetch("/api/ai/models/validate/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          modelId,
          testPrompt: "Hello",
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.valid) {
          return { status: 'valid', message: 'Model is available and working' };
        } else {
          return { status: 'invalid', message: result.message || 'Model validation failed' };
        }
      } else if (response.status === 404) {
        return { status: 'invalid', message: 'Model not found in provider API' };
      } else if (response.status === 401 || response.status === 403) {
        return { status: 'error', message: 'Authentication failed - check API keys' };
      } else {
        return { status: 'error', message: `HTTP ${response.status}: ${response.statusText}` };
      }
    } catch (error) {
      console.error(`MODEL-VALIDATION: Error validating ${modelId}:`, error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Network or configuration error'
      };
    }
  };

  const handleEditModels = (modelIds: string[]) => {
    if (modelIds.length === 1) {
      // Find the model by ID and open edit dialog
      const model = models.find(m => m.id === modelIds[0]);
      if (model) {
        handleRowClick(model);
      }
    }
  };

  const handleValidateModels = async (modelIds: string[]) => {
    if (modelIds.length === 0) return;

    // Mark models as validating
    setValidatingModels(new Set(modelIds));

    // Clear previous results for these models
    setValidationResults(prev => {
      const updated = { ...prev };
      modelIds.forEach(id => delete updated[id]);
      return updated;
    });

    showSuccess(`Validating ${modelIds.length} model(s)...`);

    const results: Record<string, { status: 'valid' | 'invalid' | 'error', message?: string }> = {};

    // Validate models sequentially to avoid overwhelming the APIs
    for (const modelId of modelIds) {
      const result = await validateModel(modelId);
      results[modelId] = result;

      // Update results incrementally
      setValidationResults(prev => ({ ...prev, [modelId]: result }));
    }

    // Clear validating state
    setValidatingModels(new Set());

    // Count results
    const validCount = Object.values(results).filter(r => r.status === 'valid').length;
    const invalidCount = Object.values(results).filter(r => r.status === 'invalid').length;
    const errorCount = Object.values(results).filter(r => r.status === 'error').length;

    // Show summary with detailed error messages
    if (validCount > 0 && invalidCount === 0 && errorCount === 0) {
      showSuccess(`All ${modelIds.length} model(s) validated successfully!`);
    } else if (invalidCount > 0) {
      showError(`${invalidCount} model(s) are invalid and should be removed or updated.`);
    } else if (errorCount > 0) {
      // Show detailed error messages for validation errors
      const errorMessages = Object.entries(results)
        .filter(([_, result]) => result.status === 'error')
        .map(([modelId, result]) => `${modelId}: ${result.message || 'Unknown error'}`)
        .join('\n');
      showError(`Validation errors:\n${errorMessages}`);
    } else {
      showSuccess(`Validation completed: ${validCount} valid, ${invalidCount} invalid, ${errorCount} errors.`);
    }
  };

  const modelFields: FieldConfig[] = [
    { key: "id", label: "Model ID", type: "text", required: true, placeholder: "provider/model-name" },
    { key: "name", label: "Name", type: "text", required: true, placeholder: "Model Display Name" },
    {
      key: "provider",
      label: "Provider",
      type: "select",
      required: false,
      placeholder: "Select a provider",
      options: [
        { value: "openai", label: "OpenAI" },
        { value: "anthropic", label: "Anthropic" },
        { value: "google", label: "Google" },
        { value: "mistral", label: "Mistral" },
        { value: "ollama", label: "Ollama" },
        { value: "inclusionai", label: "InclusionAI" },
      ],
    },
    { key: "description", label: "Description", type: "textarea", placeholder: "Model description" },
    { key: "context_length", label: "Context Length", type: "number", placeholder: "0" },
    {
      key: "modality",
      label: "Modality",
      type: "select",
      options: [
        { value: "text", label: "Text" },
        { value: "text+image", label: "Text + Image" },
        { value: "image", label: "Image" },
        { value: "audio", label: "Audio" },
        { value: "multimodal", label: "Multimodal" },
      ],
    },
    { key: "prompt", label: "Prompt Price", type: "text", placeholder: "0.000001", section: "pricing" },
    { key: "completion", label: "Completion Price", type: "text", placeholder: "0.000002", section: "pricing" },
    { key: "image", label: "Image Price", type: "text", placeholder: "0", section: "pricing" },
    { key: "request", label: "Request Price", type: "text", placeholder: "0", section: "pricing" },
    {
      key: "api_provider",
      label: "API Provider",
      type: "select",
      required: false,
      placeholder: "Select API provider",
      options: [
        { value: "", label: "Default (Provider's Direct API)" },
        { value: "vercel-gateway", label: "Vercel AI Gateway" },
      ],
      section: "advanced",
    },
  ];

  const modelTemplate: any = {
    id: "",
    name: "",
    provider: undefined,
    canonical_slug: "",
    hugging_face_id: "",
    description: "",
    context_length: 0,
    modality: "text",
    prompt: "0",
    completion: "0",
    image: "0",
    request: "0",
    api_provider: "",
  };

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const handleOpenRouterUpdate = () => {
    setOpenRouterModalOpen(true);
  };

  const handleDelete = async (ids: string[]) => {
    try {
      for (const id of ids) {
        await deleteModel(id);
      }
      showSuccess(`Deleted ${ids.length} model(s)`);
    } catch (error) {
      console.error("Error deleting models:", error);
      showError("Failed to delete models");
    }
  };

  const handleSubmit = async (data: any, isEdit: boolean) => {
    try {
      const newModel: Model = {
        id: data.id,
        canonical_slug: data.canonical_slug || data.id,
        hugging_face_id: data.hugging_face_id || "",
        name: data.name,
        created: data.created || Date.now() / 1000,
        description: data.description || "",
        context_length:
          typeof data.context_length === "string" ? parseInt(data.context_length, 10) || 0 : data.context_length || 0,
        architecture: {
          tokenizer: data.architecture?.tokenizer || "Unknown",
          instruct_type: data.architecture?.instruct_type || null,
          modality: data.modality || data.architecture?.modality || "text",
        },
        pricing: {
          prompt: data.prompt || data.pricing?.prompt || "0",
          completion: data.completion || data.pricing?.completion || "0",
          request: data.request || data.pricing?.request || "0",
          image: data.image || data.pricing?.image || "0",
          internal_reasoning: data.pricing?.internal_reasoning || "0",
        },
        top_provider: data.top_provider || {
          context_length:
            typeof data.context_length === "string" ? parseInt(data.context_length, 10) || 0 : data.context_length || 0,
          max_completion_tokens: null,
          is_moderated: false,
        },
        per_request_limits: data.per_request_limits || null,
        supported_parameters: data.supported_parameters || [],
        default_parameters: data.default_parameters || {},
        api_provider: data.api_provider || undefined,
      };
      if (isEdit) {
        // Use original model ID for the URL, even if user changed the id field
        const modelIdToUse = originalModelId || newModel.id;
        await updateModel(modelIdToUse, newModel);
        showSuccess("Model updated successfully");
      } else {
        await createModel(newModel);
        showSuccess("Model created successfully");
      }
      setEditingModel(null);
      setOriginalModelId(null);
    } catch (error) {
      console.error("Error saving model:", error);
      showError(error instanceof Error ? error.message : "Failed to save model");
    }
  };

  const handleRowClick = (model: Model) => {
    // Extract provider from model ID (e.g., "openai/gpt-4" -> "openai")
    const provider = model.id.split('/')[0];

    // Flatten the model for editing
    const editData = {
      ...model,
      provider: provider,
      modality: model.architecture.modality,
      prompt: model.pricing.prompt,
      completion: model.pricing.completion,
      image: model.pricing.image,
      request: model.pricing.request,
      api_provider: model.api_provider || "",
    };
    setEditingModel(editData);
    setOriginalModelId(model.id); // Preserve original ID for update URL
    setDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingModel(null);
      setOriginalModelId(null);
    }
  };

  const formatPrice = (price: string) => {
    if (!price || parseFloat(price) === 0) return "-";
    return `$${parseFloat(price)}`;
  };

  const modalities = Array.from(new Set(models.map((m) => m.architecture.modality).filter(Boolean)));

  const filteredModels =
    modalityFilter === "all" ? models : models.filter((m) => m.architecture.modality === modalityFilter);

  const columns: Column<Model>[] = [
    {
      id: "name",
      header: "Model",
      render: (row) => (
        <div>
          <div className="font-medium">{row.name}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{row.id}</div>
        </div>
      ),
      accessor: (row) => row.name.toLowerCase(),
      sortable: true,
      canToggle: false,
    },
    {
      id: "validation",
      header: "Status",
      render: (row) => {
        const result = validationResults[row.id];
        const isValidating = validatingModels.has(row.id);

        if (isValidating) {
          return (
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs text-blue-600">Validating...</span>
            </div>
          );
        }

        if (result) {
          const icon = result.status === 'valid' ? CheckCircle :
                      result.status === 'invalid' ? XCircle : AlertCircle;
          const color = result.status === 'valid' ? 'text-green-600' :
                       result.status === 'invalid' ? 'text-red-600' : 'text-yellow-600';
          const Icon = icon;

          return (
            <div className="flex items-center gap-1" title={result.message}>
              <Icon className={`w-4 h-4 ${color}`} />
              <span className={`text-xs capitalize ${color}`}>{result.status}</span>
            </div>
          );
        }

        return <span className="text-xs text-gray-400">Not validated</span>;
      },
      accessor: (row) => {
        const result = validationResults[row.id];
        return result ? result.status : 'unknown';
      },
      sortable: true,
    },
    {
      id: "modality",
      header: "Modality",
      render: (row) => <span className="text-sm text-gray-700 dark:text-gray-300">{row.architecture.modality}</span>,
      accessor: (row) => row.architecture.modality || "",
      sortable: true,
    },
    {
      id: "context_length",
      header: "Context Length",
      render: (row) => (
        <div className="flex items-center gap-1">
          <Zap className="h-3 w-3 text-gray-400" />
          {row.context_length?.toLocaleString()}
        </div>
      ),
      accessor: (row) => row.context_length || 0,
      sortable: true,
    },
    {
      id: "prompt_price",
      header: "Prompt",
      render: (row) => <span className="font-mono text-sm">{formatPrice(row.pricing.prompt)}</span>,
      accessor: (row) => parseFloat(row.pricing.prompt) || 0,
      sortable: true,
    },
    {
      id: "completion_price",
      header: "Completion",
      render: (row) => <span className="font-mono text-sm">{formatPrice(row.pricing.completion)}</span>,
      accessor: (row) => parseFloat(row.pricing.completion) || 0,
      sortable: true,
    },
    {
      id: "image_price",
      header: "Image",
      render: (row) => <span className="font-mono text-sm">{formatPrice(row.pricing.image)}</span>,
      accessor: (row) => parseFloat(row.pricing.image) || 0,
      sortable: true,
    },
    {
      id: "request_price",
      header: "Request",
      render: (row) => <span className="font-mono text-sm">{formatPrice(row.pricing.request)}</span>,
      accessor: (row) => parseFloat(row.pricing.request) || 0,
      sortable: true,
    },
    {
      id: "internal_reasoning_price",
      header: "Reasoning",
      render: (row) => <span className="font-mono text-sm">{formatPrice(row.pricing.internal_reasoning)}</span>,
      accessor: (row) => parseFloat(row.pricing.internal_reasoning) || 0,
      sortable: true,
    },
    {
      id: "provider",
      header: "Provider",
      render: (row) => <Badge variant="secondary">{row.id.split("/")[0]}</Badge>,
      accessor: (row) => row.id.split("/")[0],
      sortable: true,
    },
  ];

  const additionalFilters = (
    <Select value={modalityFilter} onValueChange={setModalityFilter}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Filter by modality" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Modalities</SelectItem>
        {modalities.map((modality) => (
          <SelectItem key={modality} value={modality}>
            {modality}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>AI Models</CardTitle>
              <CardDescription>Manage AI models, their pricing, and specifications</CardDescription>
            </div>
            <div className="flex gap-2">
              <ItemDialog
                title="Add New Model"
                description="Manually add a new AI model to the system."
                buttonText="Add Model"
                fields={modelFields}
                template={modelTemplate}
                onSubmit={handleSubmit}
                editData={editingModel}
                onOpenChange={handleDialogOpenChange}
                validateRequired={(data) => {
                  if (!data.id || !data.name) {
                    return { valid: false, message: "ID and name are required" };
                  }
                  return { valid: true };
                }}
              />
              <Button onClick={handleOpenRouterUpdate}>
                Update from OpenRouter
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            data={filteredModels}
            columns={columns}
            getRowId={(row) => row.id}
            onDelete={handleDelete}
            onValidate={handleValidateModels}
            validateButtonText="Validate Selected"
            onEdit={handleEditModels}
            editButtonText="Edit Selected"
            onRowClick={handleRowClick}
            searchPlaceholder="Search models..."
            searchKeys={["name", "id"]}
            additionalFilters={additionalFilters}
            loading={loading}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Models</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{models.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Modalities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{modalities.length}</div>
            <p className="text-sm text-gray-500 mt-1">Different types available</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <DollarSign className="h-4 w-4 inline mr-1" />
              Price Range
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-1">
              <div>
                <span className="text-gray-500">Free models: </span>
                <span className="font-semibold">{models.filter((m) => parseFloat(m.pricing.prompt) === 0).length}</span>
              </div>
              <div>
                <span className="text-gray-500">Paid models: </span>
                <span className="font-semibold">{models.filter((m) => parseFloat(m.pricing.prompt) > 0).length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <OpenRouterUpdateModal
        open={openRouterModalOpen}
        onOpenChange={setOpenRouterModalOpen}
        onUpdate={() => fetchModels({ force: true })}
        showProviders={false}
      />
    </div>
  );
}
