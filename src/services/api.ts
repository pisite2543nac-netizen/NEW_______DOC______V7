import {supabase} from '../lib/supabase';import type {Classroom,Grade,Profile,Subject,Submission,Worksheet} from '../types/domain';
export const api={
 async subjects(){const{data,error}=await supabase.from('subjects').select('*').order('code');if(error)throw error;return data as Subject[]},
 async classrooms(){const{data,error}=await supabase.from('classrooms').select('*').order('name');if(error)throw error;return data as Classroom[]},
 async users(){const{data,error}=await supabase.from('profiles').select('*').order('created_at',{ascending:false});if(error)throw error;return data as Profile[]},
 async worksheets(admin=true){let q=supabase.from('worksheets').select('*,subjects(code,name),classrooms(name)').order('created_at',{ascending:false});if(!admin)q=q.eq('status','published');const{data,error}=await q;if(error)throw error;return data as unknown as Worksheet[]},
 async submissions(){const{data,error}=await supabase.from('submissions').select('*,profiles(full_name,student_code,class_name),worksheets(*)').order('created_at',{ascending:false});if(error)throw error;return data as unknown as Submission[]},
 async grades(){const{data,error}=await supabase.from('submission_grades').select('*,submissions(*,profiles(full_name,student_code,class_name),worksheets(title,subjects(code,name)))').order('graded_at',{ascending:false});if(error)throw error;return data as unknown as Grade[]}
};
