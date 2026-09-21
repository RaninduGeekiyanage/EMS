# Standard Module Template

## Server Action Template

```typescript
// lib/server-actions/ems/{module-name}/{action-name}.ts
"use server";

import prisma from "@/lib/prisma";
import { yourSchema } from "@/lib/formSchema";
import { z } from "zod";

// --- Types ---
interface ActionResponse {
  success: boolean;
  message: string;
  error?: string;
  data?: { id: number } | null;
}

// --- Create Action ---
export const createEntity = async (
  values: z.infer<typeof yourSchema>
): Promise<ActionResponse> => {
  try {
    // 1. Validate
    const result = yourSchema.safeParse(values);
    if (!result.success) {
      return {
        success: false,
        message: result.error.errors[0].message,
        data: null,
      };
    }
    const data = result.data;

    // 2. Check for duplicates
    const existing = await prisma.entity.findFirst({
      where: {
        name: { contains: data.name, mode: "insensitive" },
      },
    });
    if (existing) {
      return {
        success: false,
        message: `'${data.name}' already exists.`,
        data: null,
      };
    }

    // 3. Create record
    const created = await prisma.entity.create({
      data: { name: data.name },
    });

    return {
      success: true,
      message: `'${created.name}' created successfully!`,
      data: { id: created.id },
    };
  } catch (error: any) {
    console.error("Error:", error);
    return {
      success: false,
      message: "Failed to create entity.",
      error: error.message,
      data: null,
    };
  }
};

// --- List Action ---
export const getAllEntities = async () => {
  try {
    const entities = await prisma.entity.findMany({
      orderBy: { name: "asc" },
    });
    return { success: true, data: entities };
  } catch (error) {
    console.error("Error:", error);
    return { success: false, error: "Failed to fetch entities" };
  }
};

// --- Search Action ---
export const searchEntities = async (searchTerm: string) => {
  try {
    const entities = await prisma.entity.findMany({
      where: {
        name: { contains: searchTerm, mode: "insensitive" },
      },
      orderBy: { name: "asc" },
      take: 10,
    });
    return entities.map((e) => ({ id: e.id, name: e.name }));
  } catch (error) {
    console.error("Error:", error);
    return [];
  }
};
```

---

## Zod Validation Schema Template

```typescript
// lib/formSchema.ts — Add new schema

import { z } from "zod";

export const entitySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  referenceId: z.coerce.number({ required_error: "Reference is required" }).min(1),
  isActive: z.coerce.boolean().optional(),
});

// Conditional validation example:
export const conditionalSchema = z.object({
  type: z.string().min(1),
  conditionalField: z.coerce.number().optional(),
}).refine(
  (data) => {
    if (data.type === "SPECIAL") {
      return data.conditionalField != null && data.conditionalField > 0;
    }
    return true;
  },
  {
    message: "Conditional field required for SPECIAL type",
    path: ["conditionalField"],
  }
);
```

---

## Page Component Template

```tsx
// app/ems/(group)/page-name/page.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { entitySchema } from "@/lib/formSchema";
import { createEntity, getAllEntities } from "@/lib/server-actions/ems/entity";
import { toast } from "sonner";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type FormValues = z.infer<typeof entitySchema>;

export default function ManageEntityPage() {
  const [entities, setEntities] = useState<any[]>([]);
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(entitySchema),
    defaultValues: { name: "", description: "" },
  });

  useEffect(() => {
    fetchEntities();
  }, []);

  const fetchEntities = async () => {
    const result = await getAllEntities();
    if (result.success && result.data) {
      setEntities(result.data);
    }
  };

  const onSubmit = async (values: FormValues) => {
    startTransition(async () => {
      const result = await createEntity(values);
      if (result.success) {
        toast.success(result.message);
        form.reset();
        fetchEntities();
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <div className="space-y-6 p-4">
      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle>Add Entity</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Table Card */}
      <Card>
        <CardHeader>
          <CardTitle>All Entities</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entities.map((entity) => (
                <TableRow key={entity.id}>
                  <TableCell>{entity.id}</TableCell>
                  <TableCell>{entity.name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Prisma Model Template

```prisma
model EntityName {
  id          Int      @id @default(autoincrement())
  name        String   @unique
  description String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Foreign keys
  parentId    Int
  parent      ParentModel @relation(fields: [parentId], references: [id])

  // Reverse relations
  children    ChildModel[]

  @@map("entity_name")  // snake_case table name
}
```

---

## Sidebar Navigation Entry Template

```typescript
// In components/app-sidebar.tsx → data.navMain
{
  title: "Module Name",
  url: "/ems",
  icon: IconComponent,
  isActive: true,
  items: [
    { title: "Create Entity", url: "/ems/create-entity" },
    { title: "View Entities", url: "/ems/view-entities" },
    { title: "Manage Entity", url: "/ems/manage-entity" },
  ],
},
```
