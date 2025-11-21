import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ForumPostCard from "@/components/forum/ForumPostCard";

interface Course {
  id: string;
  title: string;
}

interface Post {
  id: string;
  title: string;
  content: string;
  created_at: string;
  course_id: string;
  author_id: string;
  author: {
    full_name: string;
    email: string;
  };
}

interface Reply {
  id: string;
  post_id: string;
  content: string;
  created_at: string;
  author_id: string;
  author: {
    full_name: string;
    email: string;
  };
}

const Forum = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostCourse, setNewPostCourse] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchCourses();
    fetchPosts();
    subscribeToUpdates();
  }, [selectedCourse]);

  const fetchCourses = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: enrollmentsData } = await supabase
      .from("enrollments")
      .select("course_id")
      .eq("student_id", user.id);

    const { data: facilitatorCourses } = await supabase
      .from("courses")
      .select("id")
      .eq("facilitator_id", user.id);

    const enrolledIds = enrollmentsData?.map(e => e.course_id) || [];
    const facilitatorIds = facilitatorCourses?.map(c => c.id) || [];
    const allCourseIds = [...new Set([...enrolledIds, ...facilitatorIds])];

    if (allCourseIds.length > 0) {
      const { data } = await supabase
        .from("courses")
        .select("id, title")
        .in("id", allCourseIds);
      
      setCourses(data || []);
    }
  };

  const fetchPosts = async () => {
    let query = supabase
      .from("forum_posts")
      .select(`
        *,
        author:profiles!forum_posts_author_id_fkey(full_name, email)
      `)
      .order("created_at", { ascending: false });

    if (selectedCourse !== "all") {
      query = query.eq("course_id", selectedCourse);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching posts:", error);
      return;
    }

    setPosts(data || []);
    fetchReplies();
  };

  const fetchReplies = async () => {
    const { data, error } = await supabase
      .from("forum_replies")
      .select(`
        *,
        author:profiles!forum_replies_author_id_fkey(full_name, email)
      `)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching replies:", error);
      return;
    }

    setReplies(data || []);
  };

  const subscribeToUpdates = () => {
    const postsChannel = supabase
      .channel("forum-posts-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "forum_posts",
        },
        () => {
          fetchPosts();
        }
      )
      .subscribe();

    const repliesChannel = supabase
      .channel("forum-replies-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "forum_replies",
        },
        () => {
          fetchReplies();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(postsChannel);
      supabase.removeChannel(repliesChannel);
    };
  };

  const handleCreatePost = async () => {
    if (!newPostTitle.trim() || !newPostContent.trim() || !newPostCourse) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("forum_posts").insert({
      title: newPostTitle,
      content: newPostContent,
      course_id: newPostCourse,
      author_id: user.id,
    });

    setLoading(false);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create post",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "Post created successfully",
    });

    setNewPostTitle("");
    setNewPostContent("");
    setNewPostCourse("");
    setDialogOpen(false);
    fetchPosts();
  };

  const getPostReplies = (postId: string) => {
    return replies.filter(r => r.post_id === postId);
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Discussion Forum</h1>
            <p className="text-muted-foreground">Connect and discuss with your peers</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Post
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Post</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Course</label>
                  <Select value={newPostCourse} onValueChange={setNewPostCourse}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a course" />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map((course) => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Title</label>
                  <Input
                    placeholder="Post title"
                    value={newPostTitle}
                    onChange={(e) => setNewPostTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Content</label>
                  <Textarea
                    placeholder="What would you like to discuss?"
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    rows={6}
                  />
                </div>
                <Button onClick={handleCreatePost} disabled={loading} className="w-full">
                  Create Post
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mb-6">
          <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by course" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4">
          {posts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <h3 className="text-xl font-semibold mb-2">No discussions yet</h3>
                <p className="text-muted-foreground text-center max-w-sm">
                  Be the first to start a conversation!
                </p>
              </CardContent>
            </Card>
          ) : (
            posts.map((post) => (
              <ForumPostCard
                key={post.id}
                post={post}
                replies={getPostReplies(post.id)}
                onReplyAdded={fetchReplies}
              />
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Forum;
