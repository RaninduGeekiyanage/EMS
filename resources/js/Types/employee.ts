export type EmploymentType = 'permanent' | 'probationary' | 'contract' | 'casual' | 'part_time';

export type PaymentMode = 'monthly' | 'daily' | 'hourly';

export type EmploymentStatus = 'active' | 'resigned' | 'terminated' | 'suspended';

export interface EmployeePaymentInfo {
    id?: string;
    employee_id?: string;
    payment_mode: PaymentMode;
    basic_salary: number | string;
    daily_rate: number | string;
    hourly_rate: number | string;
    effective_date?: string | null;
}

export interface EmployeeBankInfo {
    id?: string;
    employee_id?: string;
    bank_code?: string | null;
    bank_name?: string | null;
    branch_name?: string | null;
    account_no?: string;
    account_holder_name?: string | null;
}

export interface EmployeeEpfInfo {
    id?: string;
    employee_id?: string;
    is_epf_member: boolean;
    epf_no?: string | null;
}

export interface DepartmentSummary {
    id: string;
    name: string;
    code: string | null;
}

export interface DesignationSummary {
    id: string;
    title: string;
    grade: string | null;
}

export interface BranchSummary {
    id: string;
    name: string;
    code: string | null;
}

export interface Employee {
    id: string;
    tenant_id: string;
    emp_no: string;
    nic: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    department_id: string | null;
    designation_id: string | null;
    branch_id: string | null;
    employment_type: EmploymentType;
    employment_status: EmploymentStatus;
    date_of_joining: string | null;
    biometric_device_id: string | null;
    department?: DepartmentSummary | null;
    designation?: DesignationSummary | null;
    branch?: BranchSummary | null;
    payment_info?: EmployeePaymentInfo | null;
    bank_info?: EmployeeBankInfo | null;
    epf_info?: EmployeeEpfInfo | null;
    created_at?: string;
}

export interface PaginatedData<T> {
    data: T[];
    current_page: number;
    first_page_url: string;
    from: number | null;
    last_page: number;
    last_page_url: string;
    links: Array<{
        url: string | null;
        label: string;
        active: boolean;
    }>;
    next_page_url: string | null;
    path: string;
    per_page: number;
    prev_page_url: string | null;
    to: number | null;
    total: number;
}
