"use client";

import { ExternalLink, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import type { Column } from "@/components/default/admin/DataTable";
import DataTable from "@/components/default/admin/DataTable";
import type { FieldConfig } from "@/components/default/admin/ItemDialog";
import ItemDialog from "@/components/default/admin/ItemDialog";
import { useNotificationStore } from "@/components/default/notifications";
import { Badge } from "@/components/tailwind/ui/badge";
import { Button } from "@/components/tailwind/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/tailwind/ui/card";
import { useProvidersStore } from "../stores/providersStore";
import type { Provider } from "../types";
import { OpenRouterUpdateModal } from "./OpenRouterUpdateModal";

export default function Providers() {
  const providers = useProvidersStore((state) => state.providers);
  const loading = useProvidersStore((state) => state.loading);
  const fetchProviders = useProvidersStore((state) => state.fetchProviders);
  const updateProvider = useProvidersStore((state) => state.updateProvider);
  const deleteProvider = useProvidersStore((state) => state.deleteProvider);
  const createProvider = useProvidersStore((state) => state.createProvider);

  const [updating, setUpdating] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [_dialogOpen, setDialogOpen] = useState(false);
  const [openRouterModalOpen, setOpenRouterModalOpen] = useState(false);

  const { showSuccess, showError } = useNotificationStore();

  const providerFields: FieldConfig[] = [
    { key: "name", label: "Name", type: "text", required: true, placeholder: "OpenAI" },
    { key: "slug", label: "Slug", type: "text", required: true, placeholder: "openai" },
    { key: "privacy_policy_url", label: "Privacy Policy URL", type: "url", placeholder: "https://..." },
    { key: "terms_of_service_url", label: "Terms of Service URL", type: "url", placeholder: "https://..." },
    { key: "status_page_url", label: "Status Page URL", type: "url", placeholder: "https://..." },
  ];

  const providerTemplate: Provider = {
    name: "",
    slug: "",
    privacy_policy_url: null,
    terms_of_service_url: null,
    status_page_url: null,
  };

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const handleOpenRouterUpdate = () => {
    setOpenRouterModalOpen(true);
  };

  const handleDelete = async (slugs: string[]) => {
    try {
      for (const slug of slugs) {
        await deleteProvider(slug);
      }
      showSuccess(`Deleted ${slugs.length} provider(s)`);
    } catch (error) {
      console.error("Error deleting providers:", error);
      showError("Failed to delete providers");
    }
  };

  const handleSubmit = async (data: Provider, isEdit: boolean) => {
    if (isEdit) {
      await updateProvider(data.slug, {
        ...data,
        privacy_policy_url: data.privacy_policy_url || null,
        terms_of_service_url: data.terms_of_service_url || null,
        status_page_url: data.status_page_url || null,
      });
      showSuccess("Provider updated successfully");
    } else {
      await createProvider({
        ...data,
        privacy_policy_url: data.privacy_policy_url || null,
        terms_of_service_url: data.terms_of_service_url || null,
        status_page_url: data.status_page_url || null,
      });
      showSuccess("Provider created successfully");
    }
    setEditingProvider(null);
  };

  const handleRowClick = (provider: Provider) => {
    setEditingProvider(provider);
    setDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingProvider(null);
    }
  };

  const columns: Column<Provider>[] = [
    {
      id: "name",
      header: "Name",
      accessor: (row) => row.name,
      sortable: true,
      canToggle: false,
    },
    {
      id: "slug",
      header: "Slug",
      render: (row) => <Badge variant="outline">{row.slug}</Badge>,
      accessor: (row) => row.slug,
      sortable: true,
    },
    {
      id: "links",
      header: "Links",
      render: (row) => (
        <div className="flex gap-2 flex-wrap">
          {row.privacy_policy_url && (
            <a
              href={row.privacy_policy_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm inline-flex items-center gap-1"
            >
              Privacy
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {row.terms_of_service_url && (
            <a
              href={row.terms_of_service_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm inline-flex items-center gap-1"
            >
              Terms
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {row.status_page_url && (
            <a
              href={row.status_page_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm inline-flex items-center gap-1"
            >
              Status
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>AI Providers</CardTitle>
              <CardDescription>Manage AI service providers and their information</CardDescription>
            </div>
            <div className="flex gap-2">
              <ItemDialog
                title="Add New Provider"
                description="Manually add a new AI provider to the system."
                buttonText="Add Provider"
                fields={providerFields}
                template={providerTemplate}
                onSubmit={handleSubmit}
                editData={editingProvider}
                onOpenChange={handleDialogOpenChange}
                validateRequired={(data) => {
                  if (!data.name || !data.slug) {
                    return { valid: false, message: "Name and slug are required" };
                  }
                  return { valid: true };
                }}
              />
              <Button onClick={handleOpenRouterUpdate}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Update from OpenRouter
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            data={providers}
            columns={columns}
            getRowId={(row) => row.slug}
            onDelete={handleDelete}
            onRowClick={handleRowClick}
            searchPlaceholder="Search providers..."
            searchKeys={["name", "slug"]}
            loading={loading}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Total Providers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{providers.length}</div>
        </CardContent>
      </Card>

      <OpenRouterUpdateModal
        open={openRouterModalOpen}
        onOpenChange={setOpenRouterModalOpen}
        onUpdate={fetchProviders}
      />
    </div>
  );
}
